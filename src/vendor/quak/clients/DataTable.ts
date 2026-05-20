import * as signals from "@preact/signals-core";
import { signal } from "@preact/signals-core";
import * as flech from "@uwdata/flechette";
import {
  type Coordinator,
  MosaicClient,
  queryFieldInfo,
  Selection,
} from "@uwdata/mosaic-core";
import {
  asc,
  column,
  desc,
  type FilterExpr,
  Query,
  type SelectQuery,
} from "@uwdata/mosaic-sql";
import { html } from "htl";

import { Histogram } from "./Histogram";
import { StatusBar } from "./StatusBar";
import { ValueCounts } from "./ValueCounts";
import stylesString from "./styles.css";
import { AsyncBatchReader } from "../utils/AsyncBatchReader";
import { assert } from "../utils/assert";
import { formatDataType, formatterForValue } from "../utils/formatting";
import { isFlechetteTable } from "../utils/guards";

interface DataTableOptions {
  table: string;
  schema: flech.Schema;
  height?: number;
}

type ColumnSummaryClient = Histogram | ValueCounts;
type TableRow = Record<string, unknown>;

type HeaderCell = HTMLTableCellElement & {
  vis?: ColumnSummaryClient;
  sortState: signals.Signal<"unset" | "asc" | "desc">;
};

export async function datatable(
  table: string,
  options: {
    coordinator: Coordinator;
    height?: number;
    columns?: Array<string>;
  },
): Promise<DataTable> {
  assert(options.coordinator, "Must provide a coordinator");
  const empty = await options.coordinator.query(
    Query
      .from(table)
      .select(
        options.columns?.map((columnName) => {
          return column(columnName, undefined);
        }) ?? ["*"],
      )
      .limit(0),
    { type: "arrow" },
  );
  assert(isFlechetteTable(empty), "Expected a flechette table");
  const client = new DataTable({
    table,
    schema: empty.schema,
    height: options.height,
  });
  options.coordinator.connect(client);
  return client;
}

export class DataTable extends MosaicClient {
  #meta: { table: string; schema: flech.Schema };
  #root: HTMLElement = document.createElement("div");
  #thead: HTMLTableSectionElement = document.createElement("thead");
  #tbody: HTMLTableSectionElement = document.createElement("tbody");
  #orderby: Array<{ field: string; order: "asc" | "desc" | "unset" }> = [];
  #templateRow: HTMLTableRowElement | undefined = undefined;
  #offset: number = 0;
  #limit: number = 100;
  #pendingInternalRequest: boolean = true;
  #rows: number = 11.5;
  #rowHeight: number = 22;
  #columnWidth: number = 125;
  #headerHeight: string = "94px";
  #format: Record<string, (value: unknown) => string>;
  #reader: AsyncBatchReader<TableRow> | null = null;
  #sql: signals.Signal<string | undefined> = signal();

  constructor(source: DataTableOptions) {
    super(Selection.crossfilter());
    this.#format = formatof(source.schema);
    this.#meta = source;

    let maxHeight = `${(this.#rows + 1) * this.#rowHeight - 1}px`;
    if (source.height) {
      this.#rows = Math.floor(source.height / this.#rowHeight);
      maxHeight = `${source.height}px`;
    }

    const styleEl = document.createElement("style");
    styleEl.textContent = stylesString;
    this.#root.appendChild(styleEl);

    const tableRoot = document.createElement("div");
    tableRoot.className = "table-container";
    tableRoot.style.maxHeight = maxHeight;

    tableRoot.appendChild(
      html.fragment`<table style=${{ tableLayout: "fixed" }}>${this.#thead}${this.#tbody}</table>`,
    );
    addDirectionalScrollWithPreventDefault(tableRoot);

    tableRoot.addEventListener("scroll", async () => {
      const isAtBottom = tableRoot.scrollHeight - tableRoot.scrollTop <
        this.#rows * this.#rowHeight * 1.5;
      if (isAtBottom) {
        await this.#appendRows(this.#rows);
      }
    });

    const container = document.createElement("div");
    container.className = "quak";
    container.appendChild(tableRoot);
    this.#root.appendChild(container);
  }

  get #tableRoot(): HTMLDivElement {
    return this.#root.querySelector(".table-container")!;
  }

  get sql(): signals.Signal<string | undefined> {
    return this.#sql;
  }

  node(): HTMLElement {
    return this.#root;
  }

  resize(height: number): void {
    this.#rows = Math.floor(height / this.#rowHeight);
    this.#tableRoot.style.maxHeight = `${height}px`;
    this.#tableRoot.scrollTop = 0;
  }

  get #columns() {
    return this.#meta.schema.fields.map((field) => field.name);
  }

  get #columnsAsNodes() {
    return this.#meta.schema.fields.map((field) => {
      return column(field.name, undefined);
    });
  }

  override query(filter?: FilterExpr | null | undefined): SelectQuery {
    const query = Query.from(this.#meta.table)
      .select(this.#columnsAsNodes)
      .where(filter ?? [])
      .orderby(
        this.#orderby
          .filter((o) => o.order !== "unset")
          .map((o) => o.order === "asc" ? asc(o.field) : desc(o.field)),
      );
    this.#sql.value = query.clone().toString();
    return query
      .limit(this.#limit)
      .offset(this.#offset);
  }

  override queryResult(table: flech.Table): this {
    if (!this.#pendingInternalRequest) {
      this.#reader = new AsyncBatchReader(() => {
        this.#pendingInternalRequest = true;
        this.#requestData(this.#offset + this.#limit);
      });
      this.#tbody.replaceChildren();
      this.#tableRoot.scrollTop = 0;
      this.#offset = 0;
    }
    const batch = table[Symbol.iterator]();
    this.#reader?.enqueueBatch(batch, {
      last: table.numRows < this.#limit,
    });
    return this;
  }

  override update(): this {
    if (!this.#pendingInternalRequest) {
      void this.#appendRows(this.#rows * 2);
    }
    this.#pendingInternalRequest = false;
    return this;
  }

  #requestData(offset = 0) {
    this.#offset = offset;
    const query = this.query(this.filterBy?.predicate(this));
    this.requestQuery(query);
    this.coordinator!.prefetch(query.clone().offset(offset + this.#limit));
  }

  override async prepare(): Promise<void> {
    this.filterBy?.addEventListener("value", () => {
      if (this.filterBy?.clauses.active?.predicate == null) {
        this.coordinator?.preaggregator.clear();
      }
    });

    const infos = await queryFieldInfo(
      this.coordinator!,
      this.#columns.map((columnName) => ({
        table: this.#meta.table,
        column: column(columnName, undefined),
        stats: [],
      })),
    );
    const classes = classof(this.#meta.schema);

    {
      const statusBar = new StatusBar({
        table: this.#meta.table,
        filterBy: this.filterBy,
      });
      this.coordinator!.connect(statusBar);
      this.#root.querySelector(".quak")?.appendChild(statusBar.node());
    }

    this.#templateRow = html`<tr><td></td>${infos.map((info) => html.fragment`<td class=${classes[info.column]}></td>`)}
      <td style=${{ width: "99%", borderLeft: "none", borderRight: "none" }}></td>
    </tr>`;

    const cols: Array<HeaderCell> = this.#meta.schema.fields.map((field) => {
      const info = infos.find((c) => c.column === `"${field.name}"`);
      assert(info, `No info for column ${field.name}`);
      let vis: ColumnSummaryClient | undefined;
      if (info.type === "number" || info.type === "date") {
        vis = new Histogram({
          table: this.#meta.table,
          column: field.name,
          field,
          type: info.type,
          filterBy: this.filterBy!,
        });
      } else {
        vis = new ValueCounts({
          table: this.#meta.table,
          field,
          filterBy: this.filterBy!,
        });
      }
      const th = thcol(field, this.#columnWidth, vis);
      this.coordinator!.connect(vis);
      return th;
    });

    signals.effect(() => {
      this.#orderby = cols.map((col, i) => ({
        field: this.#columns[i],
        order: col.sortState.value,
      }));
      this.#requestData();
    });

    this.#thead.appendChild(
      html`<tr style=${{ height: this.#headerHeight }}>
        <th></th>
        ${cols}
        <th style=${{ width: "99%", borderLeft: "none", borderRight: "none" }}></th>
      </tr>`,
    );

    this.#tableRoot.addEventListener("mouseover", (event) => {
      if (
        isTableCellElement(event.target) &&
        isTableRowElement(event.target.parentNode)
      ) {
        highlight(event.target, event.target.parentNode);
      }
    });
    this.#tableRoot.addEventListener("mouseout", (event) => {
      if (
        isTableCellElement(event.target) &&
        isTableRowElement(event.target.parentNode)
      ) {
        removeHighlight(event.target, event.target.parentNode);
      }
    });
  }

  async #appendRows(nrows: number) {
    nrows = Math.trunc(nrows);
    while (nrows >= 0) {
      const result = await this.#reader?.next();
      if (!result || result.done) break;
      this.#appendRow(result.value.row, result.value.index);
      nrows--;
    }
  }

  #appendRow(d: TableRow, i: number) {
    const itr = this.#templateRow?.cloneNode(true) as HTMLTableRowElement;
    assert(itr, "Must have a data row");
    let td = itr.childNodes[0] as HTMLTableCellElement;
    td.appendChild(document.createTextNode(String(i)));
    for (let j = 0; j < this.#columns.length; ++j) {
      td = itr.childNodes[j + 1] as HTMLTableCellElement;
      td.classList.remove("gray");
      const col = this.#columns[j];
      const stringified = this.#format[col](d[col]);
      if (shouldGrayoutValue(stringified)) {
        td.classList.add("gray");
      }
      td.appendChild(document.createTextNode(stringified));
    }
    this.#tbody.append(itr);
  }
}

const TRUNCATE = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

function thcol(
  field: flech.Field,
  minWidth: number,
  vis?: ColumnSummaryClient,
): HeaderCell {
  const buttonVisible = signals.signal(false);
  const width = signals.signal(minWidth);
  const sortState: signals.Signal<"unset" | "asc" | "desc"> = signals.signal("unset");

  function nextSortState() {
    sortState.value = ({
      unset: "asc",
      asc: "desc",
      desc: "unset",
    } as const)[sortState.value];
  }

  const svg = html`<svg style=${{ width: "1.5em" }} fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9L12 5.25L15.75 9" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75L15.75 15" />
  </svg>`;
  const uparrow: SVGPathElement = svg.children[0] as SVGPathElement;
  const downarrow: SVGPathElement = svg.children[1] as SVGPathElement;
  const verticalResizeHandle = document.createElement("div");
  verticalResizeHandle.className = "resize-handle";

  const sortButton = html`<span aria-role="button" class="sort-button" onmousedown=${nextSortState}>${svg}</span>`;
  const th: HTMLTableCellElement = html`<th style=${{ overflow: "hidden" }}>
    <div style=${{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style=${{ marginBottom: "5px", maxWidth: "250px", ...TRUNCATE }}>${field.name}</span>
      ${sortButton}
    </div>
    ${verticalResizeHandle}
    <span class="gray" style=${{ fontWeight: 400, fontSize: "12px", userSelect: "none" }}>${formatDataType(field.type)}</span>
    ${vis?.plot?.node()}
  </th>`;

  signals.effect(() => {
    uparrow.setAttribute("stroke", "var(--moon-gray)");
    downarrow.setAttribute("stroke", "var(--moon-gray)");
    const element = { asc: uparrow, desc: downarrow, unset: null }[sortState.value];
    element?.setAttribute("stroke", "var(--dark-gray)");
  });

  signals.effect(() => {
    sortButton.style.visibility = buttonVisible.value ? "visible" : "hidden";
  });

  signals.effect(() => {
    th.style.width = `${width.value}px`;
  });

  th.addEventListener("mouseover", () => {
    if (sortState.value === "unset") buttonVisible.value = true;
  });

  th.addEventListener("mouseleave", () => {
    if (sortState.value === "unset") buttonVisible.value = false;
  });

  th.addEventListener("dblclick", (event) => {
    if (
      event.offsetX < sortButton.offsetWidth &&
      event.offsetY < sortButton.offsetHeight
    ) {
      return;
    }
    width.value = minWidth;
  });

  verticalResizeHandle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = th.offsetWidth -
      parseFloat(getComputedStyle(th).paddingLeft) -
      parseFloat(getComputedStyle(th).paddingRight);
    function onMouseMove(moveEvent: MouseEvent) {
      const dx = moveEvent.clientX - startX;
      width.value = Math.max(minWidth, startWidth + dx);
      verticalResizeHandle.style.backgroundColor = "var(--light-silver)";
    }
    function onMouseUp() {
      verticalResizeHandle.style.backgroundColor = "transparent";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  verticalResizeHandle.addEventListener("mouseover", () => {
    verticalResizeHandle.style.backgroundColor = "var(--light-silver)";
  });

  verticalResizeHandle.addEventListener("mouseleave", () => {
    verticalResizeHandle.style.backgroundColor = "transparent";
  });

  return Object.assign(th, { vis, sortState });
}

function formatof(schema: flech.Schema) {
  const format: Record<string, (value: unknown) => string> = Object.create(null);
  for (const field of schema.fields) {
    format[field.name] = formatterForValue(field.type);
  }
  return format;
}

function classof(schema: flech.Schema): Record<string, "number" | "date"> {
  const classes: Record<string, "number" | "date"> = Object.create(null);
  for (const field of schema.fields) {
    switch (field.type.typeId) {
      case flech.Type.Int:
      case flech.Type.Float:
        classes[field.name] = "number";
        break;
      case flech.Type.Date:
      case flech.Type.Timestamp:
        classes[field.name] = "date";
        break;
    }
  }
  return classes;
}

function highlight(cell: HTMLTableCellElement, row: HTMLTableRowElement) {
  if (row.firstChild !== cell && cell !== row.lastElementChild) {
    cell.style.border = "1px solid var(--moon-gray)";
  }
  row.style.backgroundColor = "var(--light-silver)";
}

function removeHighlight(cell: HTMLTableCellElement, row: HTMLTableRowElement) {
  cell.style.removeProperty("border");
  row.style.removeProperty("background-color");
}

function isTableCellElement(node: unknown): node is HTMLTableCellElement {
  return (node as { tagName?: string } | null)?.tagName === "TD";
}

function isTableRowElement(node: unknown): node is HTMLTableRowElement {
  return node instanceof HTMLTableRowElement;
}

function shouldGrayoutValue(value: string) {
  return value === "null" || value === "undefined" || value === "NaN" || value === "TODO";
}

function addDirectionalScrollWithPreventDefault(
  root: HTMLElement,
  scrollThreshold: number = 10,
) {
  let accumulatedDeltaX = 0;
  let accumulatedDeltaY = 0;
  root.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      accumulatedDeltaX += event.deltaX;
      accumulatedDeltaY += event.deltaY;
      if (Math.abs(accumulatedDeltaX) > Math.abs(accumulatedDeltaY)) {
        if (Math.abs(accumulatedDeltaX) > scrollThreshold) {
          root.scrollLeft += accumulatedDeltaX;
          accumulatedDeltaX = 0;
          accumulatedDeltaY = 0;
        }
      } else if (Math.abs(accumulatedDeltaY) > scrollThreshold) {
        root.scrollTop += accumulatedDeltaY;
        accumulatedDeltaX = 0;
        accumulatedDeltaY = 0;
      }
    },
    { passive: false },
  );
}
