import type { FieldInfo } from "@uwdata/mosaic-core";
import type { ScaleLinear } from "d3";

export interface Bin {
  x0: number;
  x1: number;
  length: number;
}

export type Scale<Range, Output> =
  & {
    type: "linear" | "log" | "pow" | "symlog" | "time";
    domain: [Range, Range];
    range: [Output, Output];
    base?: number;
    constant?: number;
    exponent?: number;
  }
  & ScaleLinear<Range, Output>;

export interface Mark {
  type: string;
  plot: {
    getAttribute(name: string): unknown;
  };
  channelField: (channel: string, opts?: { exact?: boolean }) => FieldInfo;
}
