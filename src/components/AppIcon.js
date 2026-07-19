import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

const iconShapes = {
  menu: () => (
    <>
      <Line x1="4" y1="6" x2="20" y2="6" />
      <Line x1="4" y1="12" x2="20" y2="12" />
      <Line x1="4" y1="18" x2="20" y2="18" />
    </>
  ),
  plus: () => (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  plusCircle: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="8" x2="12" y2="16" />
      <Line x1="8" y1="12" x2="16" y2="12" />
    </>
  ),
  eraser: () => (
    <>
      <Path d="m7 21-4-4a2 2 0 0 1 0-2.8L13.2 4a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L9.8 21H7z" />
      <Line x1="5" y1="12" x2="12" y2="19" />
      <Line x1="5" y1="21" x2="21" y2="21" />
    </>
  ),
  refresh: () => (
    <>
      <Path d="M20 7v5h-5" />
      <Path d="M4 17v-5h5" />
      <Path d="M6.1 9A7 7 0 0 1 18 6l2 2" />
      <Path d="M17.9 15A7 7 0 0 1 6 18l-2-2" />
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
      <Circle cx="11" cy="11" r="7" />
      <Line x1="16.5" y1="16.5" x2="21" y2="21" />
    </>
  ),
  shield: () => (
    <>
      <Path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8z" />
      <Polyline points="9 12 11 14 15.5 9.5" />
    </>
  ),
  lock: () => (
    <>
      <Rect x="3" y="10" width="18" height="12" rx="2.5" />
      <Path d="M7 10V7a5 5 0 0 1 10 0v3" />
      <Line x1="12" y1="15" x2="12" y2="17" />
    </>
  ),
  moon: ({ color }) => (
    <Path
      d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"
      fill={color}
      stroke={color}
    />
  ),
  email: () => (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="2.5" />
      <Path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: () => (
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.34 1.81.66 2.67a2 2 0 0 1-.45 2.11L8.05 9.77a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45c.86.32 1.76.54 2.67.66A2 2 0 0 1 22 16.92z" />
  ),
  guest: () => (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M5 21a7 7 0 0 1 14 0" />
    </>
  ),
  personAdd: () => (
    <>
      <Circle cx="9" cy="7" r="4" />
      <Path d="M2 21a7 7 0 0 1 14 0" />
      <Line x1="19" y1="8" x2="19" y2="14" />
      <Line x1="16" y1="11" x2="22" y2="11" />
    </>
  ),
  chevronUp: () => <Polyline points="6 15 12 9 18 15" />,
  chevronDown: () => <Polyline points="6 9 12 15 18 9" />,
  arrowRight: () => (
    <>
      <Line x1="5" y1="12" x2="19" y2="12" />
      <Polyline points="13 6 19 12 13 18" />
    </>
  ),
  alertCircle: () => (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="7" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
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
      <Rect x="3" y="4" width="18" height="17" rx="2.5" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="3" y1="9" x2="21" y2="9" />
    </>
  ),
  trash: () => (
    <>
      <Line x1="3" y1="6" x2="21" y2="6" />
      <Path d="M8 6V4h8v2" />
      <Path d="m19 6-1 15H6L5 6" />
      <Line x1="10" y1="11" x2="10" y2="17" />
      <Line x1="14" y1="11" x2="14" y2="17" />
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
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="9" r="3" />
      <Path d="M6.5 19a6 6 0 0 1 11 0" />
    </>
  ),
  bookmark: () => <Path d="M6 3h12v18l-6-4-6 4V3z" />,
  chart: () => (
    <>
      <Path d="M3 3v18h18" />
      <Polyline points="7 16 11 12 15 15 21 8" />
    </>
  ),
  sparkles: () => (
    <>
      <Path d="M12 2l1.4 4.1a4 4 0 0 0 2.5 2.5L20 10l-4.1 1.4a4 4 0 0 0-2.5 2.5L12 18l-1.4-4.1a4 4 0 0 0-2.5-2.5L4 10l4.1-1.4a4 4 0 0 0 2.5-2.5L12 2z" />
      <Line x1="19" y1="17" x2="19" y2="22" />
      <Line x1="16.5" y1="19.5" x2="21.5" y2="19.5" />
    </>
  ),
  settings: () => (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05a1.7 1.7 0 0 0-1.55 1z" />
    </>
  ),
  logout: () => (
    <>
      <Path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <Line x1="3" y1="12" x2="15" y2="12" />
      <Polyline points="10 7 15 12 10 17" />
    </>
  ),
  send: () => (
    <>
      <Path d="m22 2-7 20-4-9-9-4 20-7z" />
      <Line x1="22" y1="2" x2="11" y2="13" />
    </>
  ),
};

function GoogleBrandIcon({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

export default function AppIcon({
  name,
  size = 24,
  color = 'black',
  strokeWidth = 2,
}) {
  if (name === 'google') {
    return <GoogleBrandIcon size={size} />;
  }

  const renderIcon = iconShapes[name] || iconShapes.info;

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
