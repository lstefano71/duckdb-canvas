import * as flech from "@uwdata/flechette";
import { format } from "d3";

function fmt<TValue>(
  formatter: (value: TValue) => string,
): (value: TValue | null | undefined) => string {
  return (value) => {
    if (value === undefined || value === null) {
      return stringify(value);
    }
    return formatter(value);
  };
}

function stringify(x: unknown): string {
  return `${x}`;
}

export function formatDataType(type: flech.DataType): string {
  switch (type.typeId) {
    case flech.Type.Dictionary: {
      const inner = formatDataType(type.dictionary);
      return `dict<${inner}>`;
    }
    case flech.Type.NONE:
      return "none";
    case flech.Type.Null:
      return "null";
    case flech.Type.Int:
      return `${type.signed ? "int" : "uint"}${type.bitWidth}`;
    case flech.Type.Float: {
      const precision = {
        [flech.Precision.HALF]: "16",
        [flech.Precision.SINGLE]: "32",
        [flech.Precision.DOUBLE]: "64",
      }[type.precision];
      return `float${precision}`;
    }
    case flech.Type.Binary:
      return "binary";
    case flech.Type.Utf8:
      return "utf8";
    case flech.Type.Bool:
      return "bool";
    case flech.Type.Decimal:
      return `decimal(${type.precision}, ${type.scale})`;
    case flech.Type.Date: {
      const unit = {
        [flech.DateUnit.DAY]: "day",
        [flech.DateUnit.MILLISECOND]: "ms",
      }[type.unit];
      return `date[${unit}]`;
    }
    case flech.Type.Time: {
      const unit = {
        [flech.TimeUnit.SECOND]: "s",
        [flech.TimeUnit.MILLISECOND]: "ms",
        [flech.TimeUnit.MICROSECOND]: "µs",
        [flech.TimeUnit.NANOSECOND]: "ns",
      }[type.unit];
      const bitWidth = type.bitWidth;
      return `time${bitWidth}[${unit}]`;
    }
    case flech.Type.Timestamp:
      return type.timezone ? `timestamp[tz=${type.timezone}]` : "timestamp";
    case flech.Type.Interval: {
      const unit = {
        [flech.IntervalUnit.YEAR_MONTH]: "ym",
        [flech.IntervalUnit.DAY_TIME]: "dt",
        [flech.IntervalUnit.MONTH_DAY_NANO]: "mdn",
      }[type.unit];
      return `interval[${unit}]`;
    }
    case flech.Type.List: {
      const inner = formatDataType(type.children[0].type);
      return `list[${inner}]`;
    }
    case flech.Type.Struct: {
      const fields = type.children.map((field) => {
        return `${field.name}: ${formatDataType(field.type)}`;
      });
      return `struct<${fields.join(", ")}>`;
    }
    case flech.Type.Union: {
      const mode = {
        [flech.UnionMode.Sparse]: "sparse",
        [flech.UnionMode.Dense]: "dense",
      }[type.mode];
      const fields = type.children.map((field) => {
        return `${field.name}: ${formatDataType(field.type)}`;
      });
      return `union<mode=${mode}>[${fields.join(", ")}]`;
    }
    case flech.Type.FixedSizeBinary:
      return `binary[stride=${type.stride}]`;
    case flech.Type.FixedSizeList: {
      const inner = formatDataType(type.children[0].type);
      return `list<stride=${type.stride}>[${inner}]`;
    }
    case flech.Type.Map: {
      const values = formatDataType(type.children[0].type);
      return `map<${values}>`;
    }
    case flech.Type.Duration: {
      const unit = {
        [flech.TimeUnit.SECOND]: "s",
        [flech.TimeUnit.MILLISECOND]: "ms",
        [flech.TimeUnit.MICROSECOND]: "µs",
        [flech.TimeUnit.NANOSECOND]: "ns",
      }[type.unit];
      return `duration[${unit}]`;
    }
    case flech.Type.LargeBinary:
      return "large binary";
    case flech.Type.LargeUtf8:
      return "large utf8";
    case flech.Type.LargeList:
      return "large list";
    case flech.Type.RunEndEncoded: {
      const values = formatDataType(type.children[0].type);
      const index = formatDataType(type.children[1].type);
      return `ree<${values}, ${index}>`;
    }
    case flech.Type.BinaryView:
      return "binary view";
    case flech.Type.Utf8View:
      return "utf8 view";
    case flech.Type.ListView:
      return "list view";
    case flech.Type.LargeListView:
      return "large list view";
  }
}

export function formatterForValue(
  type: flech.DataType,
): (value: any) => string {
  switch (type.typeId) {
    case flech.Type.NONE:
      return fmt<null>(stringify);
    case flech.Type.Null:
      return fmt<null>(stringify);
    case flech.Type.Int:
    case flech.Type.Float:
      return fmt<number | bigint>((value) => {
        if (Number.isNaN(value)) return "NaN";
        return value === 0 ? "0" : value.toLocaleString("en");
      });
    case flech.Type.Binary:
    case flech.Type.BinaryView:
    case flech.Type.FixedSizeBinary:
    case flech.Type.LargeBinary:
      return fmt<Uint8Array>((bytes) => {
        const maxlen = 32;
        let result = "b'";
        for (let i = 0; i < Math.min(bytes.length, maxlen); i++) {
          const byte = bytes[i];
          if (byte >= 32 && byte <= 126) {
            result += String.fromCharCode(byte);
          } else {
            result += `\\x${byte.toString(16).padStart(2, "0")}`;
          }
        }
        if (bytes.length > maxlen) result += "...";
        return result + "'";
      });
    case flech.Type.Utf8:
    case flech.Type.Utf8View:
    case flech.Type.LargeUtf8:
      return fmt<string>(stringify);
    case flech.Type.Bool:
      return fmt<boolean>(stringify);
    case flech.Type.Decimal:
      return fmt<number>(stringify);
    case flech.Type.Date:
    case flech.Type.Timestamp:
      return fmt<number>((value) => {
        const d = new Date(value);
        return d.toISOString();
      });
    case flech.Type.Time:
      return fmt<number>(stringify);
    case flech.Type.Duration:
      return fmt<bigint>(stringify);
    case flech.Type.Interval:
      return fmt<Uint8Array>(stringify);
    case flech.Type.List:
    case flech.Type.FixedSizeList:
    case flech.Type.LargeList:
    case flech.Type.ListView:
    case flech.Type.LargeListView:
      return fmt<Array<unknown>>((value) => JSON.stringify(value));
    case flech.Type.Struct:
    case flech.Type.Map:
      return fmt<Record<string, unknown>>((value) => JSON.stringify(value));
    case flech.Type.Union:
      return fmt<unknown>(stringify);
    case flech.Type.Dictionary:
      return formatterForValue(type.dictionary);
    case flech.Type.RunEndEncoded:
      return fmt<unknown>(stringify);
    default:
      return fmt<unknown>(stringify);
  }
}

export function percentFormatter(value: number): string {
  if (value < 0.01) return "<1%";
  return format(".0%")(value);
}
