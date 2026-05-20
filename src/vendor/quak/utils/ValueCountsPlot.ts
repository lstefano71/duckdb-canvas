import { effect, signal } from "@preact/signals-core";
import type * as flech from "@uwdata/flechette";
import * as d3 from "d3";

import { assert } from "./assert";
import { formatDataType, percentFormatter } from "./formatting";

type CountTableData = flech.Table;

interface ValueCountsPlotOptions {
  width?: number;
  height?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  nullCount?: number;
  fillColor?: string;
  nullFillColor?: string;
  backgroundBarColor?: string;
}

export function ValueCountsPlot(
  data: CountTableData,
  field: flech.Field,
  {
    width = 125,
    height = 30,
    marginBottom = 12,
    marginRight = 2,
    marginLeft = 2,
    fillColor = "var(--primary)",
    nullFillColor = "var(--secondary)",
    backgroundBarColor = "rgb(226, 226, 226)",
  }: ValueCountsPlotOptions = {},
) {
  const fieldType = formatDataType(field.type);

  const root = document.createElement("div");
  root.style.position = "relative";

  const container = document.createElement("div");
  Object.assign(container.style, {
    width: `${width}px`,
    height: `${height}px`,
    display: "flex",
    borderRadius: "5px",
    overflow: "hidden",
  });

  const bars = createBars(data, {
    width,
    height,
    marginRight,
    marginLeft,
    fillColor,
    nullFillColor,
    backgroundBarColor,
  });

  for (const bar of bars.elements) {
    container.appendChild(bar);
  }

  const text = createTextOutput();

  const hovering = signal<string | undefined>(undefined);
  const selected = signal<string | undefined>(undefined);
  const counts = signal<CountTableData>(data);
  const countLabel = signal<string>(fieldType);

  const hitArea = document.createElement("div");
  Object.assign(hitArea.style, {
    position: "absolute",
    top: "0",
    left: "-5px",
    width: `${width + 10}px`,
    height: `${height + marginBottom}px`,
    backgroundColor: "rgba(255, 255, 255, 0.01)",
    cursor: "pointer",
  });
  hitArea.addEventListener("mousemove", (event) => {
    hovering.value = bars.nearestX(event);

    const update: Record<string, number> = Object.fromEntries(
      Array.from(data.toArray(), (d) => [d.key, d.total]),
    );

    const total = Object.values(update).reduce((a, b) => a + b, 0);

    const hoveredValue = hovering.value;
    const hoveredValueCount = hoveredValue !== undefined
      ? update[hoveredValue]
      : undefined;

    countLabel.value =
      hoveredValue !== undefined && hoveredValueCount !== undefined
        ? `${hoveredValueCount} row${hoveredValueCount === 1 ? "" : "s"} (${percentFormatter(hoveredValueCount / total)})`
        : fieldType;
  });
  hitArea.addEventListener("mouseout", () => {
    hovering.value = undefined;
    countLabel.value = fieldType;
  });
  hitArea.addEventListener("mousedown", (event) => {
    const next = bars.nearestX(event);
    selected.value = selected.value === next ? undefined : next;
  });

  effect(() => {
    text.textContent = bars.textFor(hovering.value ?? selected.value);
    bars.render(counts.value, hovering.value, selected.value);

    const labelElement = root.parentElement?.parentElement?.querySelector(
      ".gray",
    );
    if (labelElement) {
      labelElement.textContent = countLabel.value;
    }
  });

  root.appendChild(container);
  root.appendChild(text);
  root.appendChild(hitArea);

  return Object.assign(root, { selected, data: counts });
}

function createBar(opts: {
  title: string;
  fillColor: string;
  textColor: string;
  height: number;
  width: number;
}) {
  const { title, fillColor, textColor, width, height } = opts;
  const bar = document.createElement("div");
  bar.title = title;
  Object.assign(bar.style, {
    background: createSplitBarFill({
      color: fillColor,
      bgColor: "var(--moon-gray)",
      frac: 50,
    }),
    width: `${width}px`,
    height: `${height}px`,
    borderColor: "white",
    borderWidth: "0px 1px 0px 0px",
    borderStyle: "solid",
    opacity: 1,
    textAlign: "center",
    position: "relative",
    display: "flex",
    overflow: "hidden",
    alignItems: "center",
    fontWeight: 400,
    fontFamily: "var(--sans-serif)",
    boxSizing: "border-box",
  });
  const span = document.createElement("span");
  Object.assign(span.style, {
    overflow: "hidden",
    width: "calc(100% - 4px)",
    left: "0px",
    position: "absolute",
    padding: "0px 2px",
    color: textColor,
  });
  if (width > 10) {
    span.textContent = title;
  }
  bar.appendChild(span);
  return bar;
}

function prepareData(data: CountTableData) {
  const arr = (data.toArray() as Array<{ key: string; total: number }>).slice()
    .sort((a, b) => b.total - a.total);
  const total = arr.reduce((acc, d) => acc + d.total, 0);
  return {
    bins: arr.filter((d) =>
      d.key !== "__quak_null__" && d.key !== "__quak_unique__"
    ),
    nullCount: arr.find((d) => d.key === "__quak_null__")?.total ?? 0,
    uniqueCount: arr.find((d) => d.key === "__quak_unique__")?.total ?? 0,
    total,
  };
}

type Entry = { key: string; total: number };

type VirtualEntry = Entry & { x: number };
type BarElement = HTMLElement & { data: Entry };
type VirtualBarElement = HTMLElement & { data: Array<Entry> };
type AnyBar = BarElement | VirtualBarElement;
type SelectionBarElement = HTMLDivElement & { data: VirtualEntry };

function isVirtualBar(bar: AnyBar): bar is VirtualBarElement {
  return Array.isArray(bar.data);
}

function isEntryBar(bar: AnyBar): bar is BarElement {
  return !isVirtualBar(bar);
}

function createBars(data: CountTableData, opts: {
  width: number;
  height: number;
  marginRight: number;
  marginLeft: number;
  fillColor: string;
  backgroundBarColor: string;
  nullFillColor: string;
}) {
  const source = prepareData(data);
  const x = d3.scaleLinear()
    .domain([0, source.total])
    .range([opts.marginLeft, opts.width - opts.marginRight]);

  const thresh = 20;

  const bars: Array<AnyBar> = [];
  for (const d of source.bins.slice(0, thresh)) {
    const bar = createBar({
      title: d.key,
      fillColor: opts.fillColor,
      textColor: "white",
      width: x(d.total),
      height: opts.height,
    });
    bars.push(Object.assign(bar, { data: d }));
  }

  const hoverBar = createVirtualSelectionBar(opts);
  const selectBar = createVirtualSelectionBar(opts);
  let virtualBar: VirtualBarElement | undefined;
  if (source.bins.length > thresh) {
    const total = source.bins.slice(thresh).reduce(
      (acc, d) => acc + d.total,
      0,
    );
    virtualBar = document.createElement("div") as unknown as VirtualBarElement;
    virtualBar.title = "__quak_virtual__";
    Object.assign(virtualBar.style, {
      width: `${x(total)}px`,
      height: "100%",
      borderColor: "white",
      borderWidth: "0px 1px 0px 0px",
      borderStyle: "solid",
      opacity: 1,
    });
    const vbars = document.createElement("div");
    Object.assign(vbars.style, {
      width: "100%",
      height: "100%",
      background:
        `repeating-linear-gradient(to right, ${opts.fillColor} 0px, ${opts.fillColor} 1px, white 1px, white 2px)`,
    });
    virtualBar.appendChild(vbars);
    virtualBar.appendChild(hoverBar);
    virtualBar.appendChild(selectBar);
    virtualBar.data = source.bins.slice(thresh);
    bars.push(virtualBar);
  }

  if (source.uniqueCount) {
    const bar = createBar({
      title: "unique",
      fillColor: opts.backgroundBarColor,
      textColor: "var(--mid-gray)",
      width: x(source.uniqueCount),
      height: opts.height,
    });
    bar.title = "__quak_unique__";
    bars.push(Object.assign(bar, {
      data: {
        key: "__quak_unique__",
        total: source.uniqueCount,
      },
    }));
  }

  if (source.nullCount) {
    const bar = createBar({
      title: "null",
      fillColor: opts.nullFillColor,
      textColor: "white",
      width: x(source.nullCount),
      height: opts.height,
    });
    bar.title = "__quak_null__";
    bars.push(Object.assign(bar, {
      data: {
        key: "__quak_null__",
        total: source.nullCount,
      },
    }));
  }

  const first = bars[0];
  const last = bars[bars.length - 1];
  if (first === last) {
    first.style.borderRadius = "5px";
  } else {
    first.style.borderRadius = "5px 0px 0px 5px";
    last.style.borderRadius = "0px 5px 5px 0px";
  }

  function virtualBin(key: string): VirtualEntry {
    assert(virtualBar);
    const voffset = bars
      .slice(0, thresh)
      .map((b) => b.getBoundingClientRect().width)
      .reduce((a, b) => a + b, 0);

    const vbins = virtualBar.data;
    const rect = virtualBar.getBoundingClientRect();
    const dx = rect.width / vbins.length;
    const idx = vbins.findIndex((d) => d.key === key);
    assert(idx !== -1, `key ${key} not found in virtual bins`);
    return {
      ...vbins[idx],
      x: dx * idx + voffset,
    };
  }

  function reset(opacity: number) {
    bars.forEach((bar) => {
      if (bar.title === "__quak_virtual__") {
        const vbars = bar.firstChild as HTMLDivElement;
        vbars.style.opacity = opacity.toString();
        vbars.style.background = createVirtualBarRepeatingBackground({
          color: opts.fillColor,
        });
      } else {
        bar.style.opacity = opacity.toString();
        bar.style.background = createSplitBarFill({
          color: bar.title === "__quak_unique__"
            ? opts.backgroundBarColor
            : bar.title === "__quak_null__"
            ? opts.nullFillColor
            : opts.fillColor,
          bgColor: opts.backgroundBarColor,
          frac: 1,
        });
      }
      bar.style.borderColor = "white";
      bar.style.borderWidth = "0px 1px 0px 0px";
      bar.style.removeProperty("box-shadow");
    });
    bars[bars.length - 1].style.borderWidth = "0px";
    hoverBar.style.visibility = "hidden";
    selectBar.style.visibility = "hidden";
  }

  function hover(key: string, selected?: string) {
    const bar = bars.find((b): b is BarElement => isEntryBar(b) && b.data.key === key);
    if (bar !== undefined) {
      bar.style.opacity = "1";
      return;
    }
    const vbin = virtualBin(key);
    hoverBar.title = vbin.key;
    hoverBar.data = vbin;
    hoverBar.style.opacity = selected ? "0.25" : "1";
    hoverBar.style.left = `${vbin.x}px`;
    hoverBar.style.visibility = "visible";
  }

  function select(key: string) {
    const bar = bars.find((b): b is BarElement => isEntryBar(b) && b.data.key === key);
    if (bar !== undefined) {
      bar.style.opacity = "1";
      bar.style.boxShadow = "inset 0 0 0 1.2px black";
      return;
    }
    const vbin = virtualBin(key);
    selectBar.style.opacity = "1";
    selectBar.title = vbin.key;
    selectBar.data = vbin;
    selectBar.style.left = `${vbin.x}px`;
    selectBar.style.visibility = "visible";
  }

  const counts: Record<string, number> = Object.fromEntries(
    Array.from(data.toArray(), (d) => [d.key, d.total]),
  );

  return {
    elements: bars,
    nearestX(event: MouseEvent): string | undefined {
      const bar = nearestX(event, bars);
      if (!bar) return;
      if (!isVirtualBar(bar)) {
        return bar.data.key;
      }
      const rect = bar.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const virtualData = bar.data;
      const idx = Math.floor((mouseX / rect.width) * virtualData.length);
      return virtualData[idx]?.key;
    },
    render(currentData: CountTableData, hovering?: string, selected?: string) {
      reset(hovering || selected ? 0.4 : 1);
      const update: Record<string, number> = Object.fromEntries(
        Array.from(currentData.toArray(), (d) => [d.key, d.total]),
      );
      const total = Object.values(update).reduce((a, b) => a + b, 0);
      for (const bar of bars) {
        if (isVirtualBar(bar)) {
          const vbars = bar.firstChild as HTMLDivElement;
          vbars.style.background = createVirtualBarRepeatingBackground({
            color: (total < source.total) || selected
              ? opts.backgroundBarColor
              : opts.fillColor,
          });
        } else {
          const key = bar.data.key;
          let frac = (update[key] ?? 0) / counts[key];
          if (selected) frac = key === selected ? frac : 0;
          bar.style.background = createSplitBarFill({
            color: bar.title === "__quak_unique__"
              ? opts.backgroundBarColor
              : bar.title === "__quak_null__"
              ? opts.nullFillColor
              : opts.fillColor,
            bgColor: opts.backgroundBarColor,
            frac: Number.isNaN(frac) ? 0 : frac,
          });
        }
      }
      if (hovering !== undefined) {
        hover(hovering, selected);
      }
      if (selected !== undefined) {
        select(selected);
      }
    },
    textFor(key?: string): string {
      if (key === undefined) {
        const ncats = data.numRows;
        return `${ncats.toLocaleString()} categor${ncats === 1 ? "y" : "ies"}`;
      }
      if (key === "__quak_unique__") {
        return `${source.uniqueCount.toLocaleString()} unique value${source.uniqueCount === 1 ? "" : "s"}`;
      }
      if (key === "__quak_null__") {
        return "null";
      }
      return key.toString();
    },
  };
}

function createTextOutput() {
  const node = document.createElement("div");
  Object.assign(node.style, {
    pointerEvents: "none",
    height: "15px",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    position: "absolute",
    fontWeight: 400,
    marginTop: "1.5px",
    color: "var(--mid-gray)",
  });
  return node;
}

function createVirtualSelectionBar(opts: { fillColor: string }): SelectionBarElement {
  const node = document.createElement("div");
  Object.assign(node.style, {
    position: "absolute",
    top: "0",
    width: "1.5px",
    height: "100%",
    backgroundColor: opts.fillColor,
    pointerEvents: "none",
    visibility: "hidden",
  });
  return Object.assign(node, {
    data: { key: "", total: 0, x: 0 },
  });
}

function nearestX(
  { clientX }: MouseEvent,
  bars: Array<AnyBar>,
) {
  for (const bar of bars) {
    const rect = bar.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right) {
      return bar;
    }
  }
}

function createSplitBarFill(
  options: { color: string; bgColor: string; frac: number },
) {
  const { color, bgColor, frac } = options;
  const p = frac * 100;
  return `linear-gradient(to top, ${color} ${p}%, ${bgColor} ${p}%, ${bgColor} ${100 - p}%)`;
}

function createVirtualBarRepeatingBackground({ color }: { color: string }) {
  return `repeating-linear-gradient(to right, ${color} 0px, ${color} 1px, white 1px, white 2px)`;
}
