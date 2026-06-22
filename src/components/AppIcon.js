import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

const iconPaths = {
  menu: () => (
    <>
      <Line x1="4" y1="7" x2="20" y2="7" />
      <Line x1="4" y1="12" x2="20" y2="12" />
      <Line x1="4" y1="17" x2="20" y2="17" />
    </>
  ),
  refresh: () => (
    <>
      <Path d="M20 6v5h-5" />
      <Path d="M4 18v-5h5" />
      <Path d="M18 9a7 7 0 0 0-11.9-2.7L4 8" />
      <Path d="M6 15a7 7 0 0 0 11.9 2.7L20 16" />
    </>
  ),
  info: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="11" x2="12" y2="17" />
      <Line x1="12" y1="7" x2="12.01" y2="7" />
    </>
  ),
  calendar: () => (
    <>
      <Rect x="4" y="5" width="16" height="15" rx="2" />
      <Line x1="8" y1="3" x2="8" y2="7" />
      <Line x1="16" y1="3" x2="16" y2="7" />
      <Line x1="4" y1="10" x2="20" y2="10" />
      <Line x1="8" y1="14" x2="8.01" y2="14" />
      <Line x1="12" y1="14" x2="12.01" y2="14" />
      <Line x1="16" y1="14" x2="16.01" y2="14" />
    </>
  ),
  trash: () => (
    <>
      <Path d="M5 7h14" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
      <Path d="M7 7l1 13h8l1-13" />
      <Path d="M9 7V4h6v3" />
    </>
  ),
  close: () => (
    <>
      <Line x1="6" y1="6" x2="18" y2="18" />
      <Line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  check: () => <Polyline points="5 13 9.5 17.5 19 7" />,
  profile: () => (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  bookmark: ({ color }) => (
    <Path d="M7 4h10v16l-5-3-5 3z" fill={color} stroke={color} />
  ),
  chart: ({ color }) => (
    <>
      <Path d="M4 19h16" />
      <Path d="M6 16l4-5 4 3 4-7" />
      <Circle cx="6" cy="16" r="1" fill={color} stroke="none" />
      <Circle cx="10" cy="11" r="1" fill={color} stroke="none" />
      <Circle cx="14" cy="14" r="1" fill={color} stroke="none" />
      <Circle cx="18" cy="7" r="1" fill={color} stroke="none" />
    </>
  ),
  settings: () => (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 3v2" />
      <Path d="M12 19v2" />
      <Path d="M4.2 7.5l1.7 1" />
      <Path d="M18.1 15.5l1.7 1" />
      <Path d="M4.2 16.5l1.7-1" />
      <Path d="M18.1 8.5l1.7-1" />
      <Path d="M7 4.7l1 1.7" />
      <Path d="M16 17.6l1 1.7" />
      <Path d="M7 19.3l1-1.7" />
      <Path d="M16 6.4l1-1.7" />
    </>
  ),
  logout: () => (
    <>
      <Path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      <Path d="M14 8l4 4-4 4" />
      <Path d="M18 12H9" />
    </>
  ),
  send: ({ color }) => (
    <>
      <Path d="M4 12L20 4l-5 16-3-7z" fill={color} stroke={color} />
      <Path d="M12 13l8-9" stroke="#fff" strokeWidth={1.6} />
    </>
  ),
};

export default function AppIcon({
  name,
  size = 24,
  color = 'black',
  strokeWidth = 2,
}) {
  const renderIcon = iconPaths[name] || iconPaths.info;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderIcon({ color })}
    </Svg>
  );
}
