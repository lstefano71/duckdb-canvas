import { effect } from "@preact/signals-core";
import type * as flech from "@uwdata/flechette";
import * as d3 from "d3";

import type { Bin, Scale } from "../types";
import { assert } from "../utils/assert";
import { formatDataType, percentFormatter } from "./formatting";
import { tickFormatterForBins } from "./tick-formatter-for-bins";

interface HistogramOptions {
  type: "number" | "date";
  width?: number;
  height?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  nullCount?: number;
  fillColor?: string;
  nullFillColor?: string;
  backgroundBarColor?: string;
}

export function CrossfilterHistogramPlot(
  bins: Array<Bin>,
  field: flech.Field,
  {
    type = "number",
    width = 125,
    height = 40,
    marginTop = 0,
    marginRight = 2,
    marginBottom = 12,
    marginLeft = 2,
    nullCount = 0,
    fillColor = "var(--primary)",
    nullFillColor = "var(--secondary)",
    backgroundBarColor = "var(--moon-gray)",
  }: HistogramOptions,
): SVGSVGElement & {
  scale: (type: string) => Scale<number, number> | undefined;
  update(bins: Array<Bin>, opts: { nullCount: number }): void;
  reset(): void;
} {
  const fieldType = formatDataType(field.type);
  const total = bins.reduce((sum, bin) => sum + bin.length, 0);
  let hovered: number | Date | undefined = undefined;
  let countLabel = fieldType;
  const nullBinWidth = nullCount === 0 ? 0 : 5;
  const spacing = nullBinWidth ? 4 : 0;
  const extent = /** @type {const} */ ([
    Math.min(...bins.map((d) => d.x0)),
    Math.max(...bins.map((d) => d.x1)),
  ]);
  const x = type === "date" ? d3.scaleUtc() : d3.scaleLinear();
  x
    .domain(extent)
    // @ts-expect-error - range is ok with number for both number and time
    .range([marginLeft + nullBinWidth + spacing, width - marginRight])
    .nice();

  const y = d3.scaleLinear()
    .domain([0, Math.max(nullCount, ...bins.map((d) => d.length))])
    .range([height - marginBottom, marginTop]);

  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; overflow: visible;");

  svg.append("g")
    .attr("fill", backgroundBarColor)
    .selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("x", (d) => x(d.x0) + 1.5)
    .attr("width", (d) => x(d.x1) - x(d.x0) - 1.5)
    .attr("y", (d) => y(d.length))
    .attr("height", (d) => y(0) - y(d.length));

  const foregroundBarGroup = svg
    .append("g")
    .attr("fill", fillColor);

  const axes = svg
    .append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues([...x.domain(), 0])
        .tickFormat(tickFormatterForBins(type, bins))
        .tickSize(2.5),
    )
    .call((g) => {
      g.select(".domain").remove();
      g.attr("class", "gray");
      g.selectAll(".tick text")
        .attr("text-anchor", (_d, i) => ["start", "end", "start"][i])
        .attr("dx", (_d, i) => ["-0.25em", "0.25em", "-0.25em"][i]);
    });

  const hoveredTickGroup = axes.node()?.querySelectorAll(".tick")[2];
  assert(hoveredTickGroup, "invariant");
  const hoveredTick = d3.select(hoveredTickGroup);

  const hoverLabelBackground = hoveredTick
    .insert("rect", ":first-child")
    .attr("width", 20)
    .attr("height", 20)
    .style("fill", "white");

  const fmt = type === "number"
    ? d3.format(".3s")
    : tickFormatterForBins(type, bins);

  const [xmin, xmax] = x.domain();
  const renderHovered = () => {
    hoveredTick
      .attr("transform", `translate(${x(hovered ?? xmin)},0)`)
      .attr("visibility", hovered ? "visible" : "hidden");

    hoveredTick
      .selectAll("text")
      .text(`${fmt(hovered ?? xmin)}`)
      .attr("visibility", hovered ? "visible" : "hidden");

    const hoveredTickText = hoveredTick
      .select("text")
      .node() as SVGTextElement;
    const bbox = hoveredTickText.getBBox();
    const cond = (x(hovered ?? xmin) + bbox.width) > x(xmax);

    hoveredTickText.setAttribute("text-anchor", cond ? "end" : "start");
    hoveredTickText.setAttribute("dx", cond ? "-0.25em" : "0.25em");

    hoverLabelBackground
      .attr("visibility", hovered ? "visible" : "hidden")
      .attr(
        "transform",
        `translate(${(cond ? -bbox.width : 0) - 2.5}, 2.5)`,
      )
      .attr("width", bbox.width + 5)
      .attr("height", bbox.height + 5);

    const labelElement = svg
      .node()
      ?.parentElement?.parentElement?.querySelector(".gray");
    if (labelElement) {
      labelElement.textContent = countLabel;
    }
  };
  effect(renderHovered);

  let foregroundNullGroup: typeof foregroundBarGroup | undefined = undefined;
  if (nullCount > 0) {
    const xnull = d3.scaleLinear()
      .range([marginLeft, marginLeft + nullBinWidth]);

    svg.append("g")
      .attr("fill", backgroundBarColor)
      .append("rect")
      .attr("x", xnull(0))
      .attr("width", xnull(1) - xnull(0))
      .attr("y", y(nullCount))
      .attr("height", y(0) - y(nullCount));

    foregroundNullGroup = svg
      .append("g")
      .attr("fill", nullFillColor)
      .attr("color", nullFillColor);

    foregroundNullGroup.append("rect")
      .attr("x", xnull(0))
      .attr("width", xnull(1) - xnull(0));

    const axisGroup = foregroundNullGroup.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .append("g")
      .attr("transform", `translate(${xnull(0.5)}, 0)`)
      .attr("class", "tick");

    axisGroup
      .append("line")
      .attr("stroke", "currentColor")
      .attr("y2", 2.5);

    axisGroup
      .append("text")
      .attr("fill", "currentColor")
      .attr("y", 4.5)
      .attr("dy", "0.71em")
      .attr("text-anchor", "middle")
      .text("∅")
      .attr("font-size", "0.9em")
      .attr("font-family", "var(--sans-serif)")
      .attr("font-weight", "normal");
  }

  svg.selectAll(".tick")
    .attr("font-family", "var(--sans-serif)")
    .attr("font-weight", "normal");

  function render(currentBins: Array<Bin>, currentNullCount: number) {
    foregroundBarGroup
      .selectAll("rect")
      .data(currentBins)
      .join("rect")
      .attr("x", (d) => x(d.x0) + 1.5)
      .attr("width", (d) => x(d.x1) - x(d.x0) - 1.5)
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => y(0) - y(d.length))
      .attr("opacity", 1);
    foregroundNullGroup
      ?.select("rect")
      .attr("y", y(currentNullCount))
      .attr("height", y(0) - y(currentNullCount));
  }

  function wrapScale(
    scale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>,
    scaleType: "time" | "linear",
  ): Scale<number, number> {
    const domain = scale.domain() as unknown as [number, number];
    const range = scale.range() as [number, number];
    return Object.assign(
      (value: number) => scale(value),
      {
        ...scale,
        type: scaleType,
        domain,
        range,
        apply: scale,
        invert: scale.invert?.bind(scale),
      },
    ) as unknown as Scale<number, number>;
  }

  const scales = {
    x: wrapScale(x, type === "date" ? "time" : "linear"),
    y: wrapScale(y, "linear"),
  };
  const node = svg.node();
  assert(node, "Infallable");

  function findClosestRect(xCoord: number): SVGRectElement | null {
    let closestRect: SVGRectElement | null = null;
    let minDistance = Infinity;

    foregroundBarGroup.selectAll("rect").each(function () {
      const rect = d3.select(this);
      const rectX = parseFloat(rect.attr("x"));
      const rectWidth = parseFloat(rect.attr("width"));
      const rectCenter = rectX + rectWidth / 2;
      const distance = Math.abs(xCoord - rectCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestRect = this as SVGRectElement;
      }
    });

    return closestRect;
  }

  axes.on("mousemove", (event) => {
    const relativeX = event.clientX - node.getBoundingClientRect().left;
    const hoveredX = x.invert(relativeX);
    hovered = clamp(hoveredX, xmin, xmax);

    const closestRect = findClosestRect(relativeX);

    foregroundBarGroup.selectAll("rect").attr("opacity", function () {
      return this === closestRect ? 1 : 0.3;
    });

    const hoveredValue = hovered;
    const hoveredBin = hoveredValue !== undefined
      ? bins.find((bin) => hoveredValue >= bin.x0 && hoveredValue < bin.x1)
      : undefined;
    const hoveredValueCount = hoveredBin?.length;

    countLabel = hoveredValue !== undefined && hoveredValueCount !== undefined
      ? `${hoveredValueCount} row${hoveredValueCount === 1 ? "" : "s"} (${percentFormatter(hoveredValueCount / total)})`
      : fieldType;
    renderHovered();
  });

  node.addEventListener("mousemove", (event) => {
    const relativeX = event.clientX - node.getBoundingClientRect().left;
    hovered = clamp(x.invert(relativeX), xmin, xmax);
    renderHovered();
  });

  axes.on("mouseleave", () => {
    hovered = undefined;
    foregroundBarGroup.selectAll("rect").attr("opacity", 1);
    countLabel = fieldType;
    renderHovered();
  });

  node.addEventListener("mouseleave", () => {
    hovered = undefined;
    renderHovered();
  });

  render(bins, nullCount);
  return Object.assign(node, {
    scale(scaleType: string) {
      if (scaleType === "fx" || scaleType === "fy") {
        return undefined;
      }
      const scale = scales[scaleType as keyof typeof scales];
      assert(scale, `Invalid scale type ${scaleType}`);
      return scale;
    },
    update(currentBins: Array<Bin>, { nullCount: currentNullCount }: { nullCount: number }) {
      render(currentBins, currentNullCount);
    },
    reset() {
      render(bins, nullCount);
    },
  });
}

function clamp(
  value: number | Date,
  min: number | Date,
  max: number | Date,
): number {
  // @ts-expect-error - value is either number or Date
  return Math.max(min, Math.min(max, value));
}
