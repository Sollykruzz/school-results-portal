import React from 'react';
import { getActiveSchoolConfig } from '../config/schoolConfig';

interface SchoolStampProps {
  date?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSignature?: boolean;
  schoolName?: string;
  bottomText?: string;
}

export const SchoolStamp: React.FC<SchoolStampProps> = ({
  date,
  className = '',
  size = 'md',
  showSignature = true,
  schoolName,
  bottomText,
}) => {
  const activeConfig = getActiveSchoolConfig();
  const rawTopText = (schoolName || activeConfig.stampTopText || activeConfig.schoolName).toUpperCase();
  const rawBottomText = (bottomText || activeConfig.stampBottomText || activeConfig.motto || 'OFFICIAL SEAL • APPROVED').toUpperCase();
  const formattedDate = date || new Date().toLocaleDateString();

  // Dynamic font sizing based on length of school name
  const topFontSize = rawTopText.length > 32 ? '8' : rawTopText.length > 24 ? '9' : '10.5';
  const bottomFontSize = rawBottomText.length > 28 ? '7.5' : '9';

  const dimensions =
    size === 'sm'
      ? { width: 140, height: 90, scale: 'w-[140px] h-[90px]' }
      : size === 'lg'
      ? { width: 220, height: 140, scale: 'w-[220px] h-[140px]' }
      : { width: 175, height: 110, scale: 'w-[175px] h-[110px]' };

  return (
    <div
      className={`inline-block select-none pointer-events-none transform -rotate-3 transition-transform ${dimensions.scale} ${className}`}
      style={{ filter: 'drop-shadow(0 1px 2px rgba(30, 64, 175, 0.2))' }}
      title={`${rawTopText} Official Seal & Stamp`}
    >
      <svg
        viewBox="0 0 240 150"
        className="w-full h-full text-blue-900"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Top curve for school name */}
          <path
            id="stamp-top-arc"
            d="M 24,78 A 98,56 0 0,1 216,78"
            fill="none"
          />
          {/* Bottom curve for location or motto */}
          <path
            id="stamp-bottom-arc"
            d="M 210,75 A 94,54 0 0,1 30,75"
            fill="none"
          />
        </defs>

        {/* Outer Oval Border (Thick rubber stamp outline) */}
        <ellipse
          cx="120"
          cy="75"
          rx="112"
          ry="68"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.8"
          strokeDasharray="200, 0.5"
          className="opacity-95"
        />

        {/* Inner Oval Border (Thin inner line) */}
        <ellipse
          cx="120"
          cy="75"
          rx="98"
          ry="54"
          fill="rgba(239, 246, 255, 0.25)"
          stroke="currentColor"
          strokeWidth="1.8"
          className="opacity-90"
        />

        {/* Left and Right Side Separator Stars */}
        <circle cx="26" cy="74" r="3.2" fill="currentColor" />
        <circle cx="214" cy="74" r="3.2" fill="currentColor" />

        {/* Top Arc Text: School Name */}
        <text
          fill="currentColor"
          fontSize={topFontSize}
          fontFamily="'Arial Black', Impact, sans-serif"
          fontWeight="900"
          letterSpacing="0.6"
          className="uppercase tracking-wider"
        >
          <textPath
            href="#stamp-top-arc"
            startOffset="50%"
            textAnchor="middle"
          >
            {rawTopText}
          </textPath>
        </text>

        {/* Bottom Arc Text: Motto / Seal Identifier */}
        <text
          fill="currentColor"
          fontSize={bottomFontSize}
          fontFamily="'Arial Black', Impact, sans-serif"
          fontWeight="900"
          letterSpacing="0.8"
          className="uppercase tracking-wider"
        >
          <textPath
            href="#stamp-bottom-arc"
            startOffset="50%"
            textAnchor="middle"
          >
            {rawBottomText}
          </textPath>
        </text>

        {/* Inner Stamp Center Area */}
        <g transform="translate(0, 0)">
          {/* SIGN label and line */}
          <text
            x="120"
            y="65"
            textAnchor="middle"
            fill="currentColor"
            fontSize="12"
            fontFamily="'Arial Black', Impact, sans-serif"
            fontWeight="900"
            letterSpacing="2"
          >
            SIGN
          </text>
          <line
            x1="52"
            y1="50"
            x2="188"
            y2="50"
            stroke="currentColor"
            strokeWidth="1.6"
            className="opacity-80"
          />

          {/* Authentic Signature Pen Stroke Overlay */}
          {showSignature && (
            <path
              d="M 70,55 C 82,40 88,38 98,54 C 104,62 115,35 128,48 C 138,58 152,42 168,46 C 172,47 165,58 150,60"
              fill="none"
              stroke="#1e3a8a"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-85"
            />
          )}

          {/* DATE label and formatted date line */}
          <text
            x="120"
            y="94"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10"
            fontFamily="'Arial Black', Impact, sans-serif"
            fontWeight="900"
            letterSpacing="1.2"
          >
            DATE: {formattedDate}
          </text>

          {/* Dotted underline */}
          <line
            x1="60"
            y1="100"
            x2="180"
            y2="100"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="2, 3"
            className="opacity-70"
          />
        </g>
      </svg>
    </div>
  );
};


