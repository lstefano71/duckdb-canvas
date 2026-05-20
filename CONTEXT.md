# DuckDB Canvas — Domain Glossary

## QueryCell
A single tldraw shape containing a SQL query editor and its result datatable side by side. The atomic unit of computation on the canvas. Replaces the earlier QueryShape + ResultShape pair.

## ChartCell
A separate tldraw shape that visualises the output of a QueryCell using Observable Plot. References a QueryCell by its view name. Not yet implemented.

## Split Ratio
A number (0.0–1.0) defining how much of a QueryCell's width is allocated to the query panel. Persisted in shape props. Default: 0.4.

## View Name
The name of the DuckDB in-memory table/view (`quak_result_N`) that holds the materialised query result. Used by the quak datatable and potentially by downstream ChartCells. Ephemeral — lost on page reload.
