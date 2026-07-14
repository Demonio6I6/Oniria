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
  search: () => (
    <>
      <Circle cx="11" cy="11" r="6" />
      <Line x1="16" y1="16" x2="20" y2="20" />
    </>
  ),
  shield: () => (
    <>
      <Path d="M12 3l7 3v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3z" />
      <Polyline points="9 12 11 14 15 10" />
    </>
  ),
  moon: ({ color }) => (
    <Path
      d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5z"
      fill={color}
      stroke={color}
    />
  ),
  google: () => (
    <>
      <Path d="M19.2 8.1a8 8 0 1 0 .3 7.9" />
      <Path d="M20 12h-7" />
      <Path d="M16.8 12v3.1" />
    </>
  ),
  email: () => (
    <>
      <Rect x="4" y="6" width="16" height="12" rx="2" />
      <Path d="M5 8l7 5 7-5" />
    </>
  ),
  phone: () => (
    <Path d="M7 4h3.3l1.4 4-2 1.1a11 11 0 0 0 5.2 5.2l1.1-2 4 1.4V17a3 3 0 0 1-3.2 3A14.5 14.5 0 0 1 4 7.2 3 3 0 0 1 7 4z" />
  ),
  guest: () => (
    <>
      <Path d="M6 11h12l-1.7-5H7.7L6 11z" />
      <Circle cx="8.5" cy="15" r="2" />
      <Circle cx="15.5" cy="15" r="2" />
      <Path d="M10.5 15h3" />
    </>
  ),
  chevronUp: () => <Polyline points="6 14 12 8 18 14" />,
  chevronDown: () => <Polyline points="6 10 12 16 18 10" />,
  arrowRight: () => (
    <>
      <Path d="M5 12h14" />
      <Path d="M13 6l6 6-6 6" />
    </>
  ),
  alertCircle: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v6" />
      <Path d="M12 17h.01" />
    </>
  ),
  checkCircle: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="8 12.5 11 15.5 16.5 9" />
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
