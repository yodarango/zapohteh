export function SimpleGrid({
  children,
  className = "",
  columns,
  minColWidth = "25rem",
  maxColWidth = "1fr",
  equalHeight = true,
  ...restOfProps
}) {
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: columns
      ? `repeat(${columns}, 1fr)`
      : `repeat(auto-fill, minmax(${minColWidth}, ${maxColWidth}))`,
  };

  const gridClass = `grid gap-4 auto-rows-fr ${
    equalHeight ? "[&>*]:h-full" : ""
  } ${className}`;

  return (
    <div className={gridClass} style={gridStyle} {...restOfProps}>
      {children}
    </div>
  );
}
