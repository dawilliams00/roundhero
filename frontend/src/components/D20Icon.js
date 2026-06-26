import React from 'react';

export default function D20Icon({ size = 16, color = 'currentColor', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.3"
      style={{verticalAlign:'middle',display:'inline-block',...style}}>
      <polygon points="12,1.5 21.5,7.5 21.5,16.5 12,22.5 2.5,16.5 2.5,7.5" strokeLinejoin="round" />
      <polyline points="12,1.5 12,9" />
      <polyline points="21.5,7.5 12,9 2.5,7.5" />
      <polyline points="12,9 12,22.5" />
      <polyline points="21.5,16.5 12,9" />
      <polyline points="2.5,16.5 12,9" />
    </svg>
  );
}
