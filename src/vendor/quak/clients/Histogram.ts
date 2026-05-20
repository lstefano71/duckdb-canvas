import type * as flech from "@uwdata/flechette";
import {
  type FieldInfo,
  MosaicClient,
  queryFieldInfo,
  type Selection,
} from "@uwdata/mosaic-core";
import * as mplot from "@uwdata/mosaic-plot";
import { count, type ExprNode, Query } from "@uwdata/mosaic-sql";

import type { Mark } from "../types";
import { CrossfilterHistogramPlot } from "../utils/CrossfilterHistogramPlot";
import { assert } from "../utils/assert";

interface HistogramOptions {
  table: string;
  field: flech.Field;
  column: string;
  type: "number" | "date";
  filterBy: Selection;
}

type BinTable = flech.Table;

export class Histogram extends MosaicClient implements Mark {
  #source: {
    table: string;
    column: string;
    field: flech.Field;
    type: "number" | "date";
  };
  #el: HTMLElement = document.createElement("div");
  #select: {
    x1: ExprNode;
    x2: ExprNode;
    y: ExprNode;
  };
  #interval: any | undefined = undefined;
  #initialized: boolean = false;
  #fieldInfo: FieldInfo | undefined;

  svg: ReturnType<typeof CrossfilterHistogramPlot> | undefined;

  constructor(options: HistogramOptions) {
    super(options.filterBy);
    this.#source = {
      table: options.table,
      column: options.field.name,
      field: options.field,
      type: options.type,
    };
    const bin = (mplot as any).bin(options.column, { steps: 18 })(this, "x");
    this.#select = { x1: bin.x1, x2: bin.x2, y: count() };
    this.#interval = new (mplot as any).Interval1D(this, {
      channel: "x",
      selection: this.filterBy,
      field: this.#source.column,
      brush: undefined,
    });
  }

  override async prepare(): Promise<void> {
    const info = await queryFieldInfo(
      this.coordinator!,
      [
        {
          table: this.#source.table,
          column: this.#source.column,
          stats: ["min", "max"],
        },
      ],
    );
    this.#fieldInfo = info[0];
  }

  override query(filter: Array<ExprNode> = []): Query {
    return Query
      .from({ source: this.#source.table })
      .select(this.#select)
      .groupby(["x1", "x2"])
      .where(filter);
  }

  override queryResult(data: BinTable) {
    const bins: Array<{ x0: number; x1: number; length: number }> = data
      .toArray()
      .map((d: any) => ({ x0: d.x1, x1: d.x2, length: d.y }));
    let nullCount = 0;
    const nullBinIndex = bins.findIndex((b) => b.x0 == null);
    if (nullBinIndex >= 0) {
      nullCount = bins[nullBinIndex].length;
      bins.splice(nullBinIndex, 1);
    }
    if (!this.#initialized) {
      this.svg = CrossfilterHistogramPlot(bins, this.#source.field, {
        nullCount,
        type: this.#source.type,
      });
      this.#interval?.init(this.svg, null);
      this.#el.appendChild(this.svg);
      this.#initialized = true;
    } else {
      this.svg?.update(bins, { nullCount });
    }
    return this;
  }

  reset() {
    this.#interval?.reset();
    this.svg?.reset();
  }

  type = "rectY";
  channelField(channel: string) {
    assert(channel === "x");
    assert(this.#fieldInfo, "No field info yet");
    return this.#fieldInfo;
  }
  get plot() {
    return {
      node: () => this.#el,
      getAttribute(_name: string) {
        return undefined;
      },
    };
  }
}
