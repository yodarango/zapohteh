import React from "react";

export const Loading = (props) => {
  const { color = "#0077ff", size = 200, ...restProps } = props;

  // Calculate proportional dimensions based on size
  const rectWidth = (30 / 200) * size;
  const rectHeight = (30 / 200) * size;
  const strokeWidth = (12 / 200) * size;
  const yPosition = (85 / 200) * size;
  const xPositions = [(25 / 200) * size, (85 / 200) * size, (145 / 200) * size];

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      {...restProps}
    >
      <rect
        fill={color}
        stroke={color}
        strokeWidth={strokeWidth}
        width={rectWidth}
        height={rectHeight}
        x={xPositions[0]}
        y={yPosition}
      >
        <animate
          attributeName='opacity'
          calcMode='spline'
          dur='2'
          values='1;0;1;'
          keySplines='.5 0 .5 1;.5 0 .5 1'
          repeatCount='indefinite'
          begin='-.4'
        ></animate>
      </rect>
      <rect
        fill={color}
        stroke={color}
        strokeWidth={strokeWidth}
        width={rectWidth}
        height={rectHeight}
        x={xPositions[1]}
        y={yPosition}
      >
        <animate
          attributeName='opacity'
          calcMode='spline'
          dur='2'
          values='1;0;1;'
          keySplines='.5 0 .5 1;.5 0 .5 1'
          repeatCount='indefinite'
          begin='-.2'
        ></animate>
      </rect>
      <rect
        fill={color}
        stroke={color}
        strokeWidth={strokeWidth}
        width={rectWidth}
        height={rectHeight}
        x={xPositions[2]}
        y={yPosition}
      >
        <animate
          attributeName='opacity'
          calcMode='spline'
          dur='2'
          values='1;0;1;'
          keySplines='.5 0 .5 1;.5 0 .5 1'
          repeatCount='indefinite'
          begin='0'
        ></animate>
      </rect>
    </svg>
  );
};
