import React from 'react';
import type { NodeShape } from '../../core/types';

export interface NodeShapeRendererProps {
  shape: NodeShape;
  width: number;
  height: number;
  selected?: boolean;
  hovered?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const NodeShapeRenderer = ({
  shape,
  className = '',
  children,
}: NodeShapeRendererProps) => {
  const isLegacyShape = [
    'process',
    'rounded',
    'stadium',
    'decision',
    'event',
    'endEvent',
    'database',
    'file',
    'subroutine',
    'hexagon',
    'parallelogram',
    'parallelogramAlt',
    'trapezoid',
    'trapezoidAlt',
    'asymmetric',
    'documents',
  ].includes(shape);

  if (isLegacyShape) {
    // Return legacy HTML/CSS wrapper structure to guarantee zero regressions for original shapes
    if (shape === 'decision') {
      return (
        <div className={`decision-bg-container`}>
          <div className="decision-bg"></div>
          <div className="decision-text">{children}</div>
        </div>
      );
    }

    if (shape === 'event') {
      return <div className="event-inner">{children}</div>;
    }

    if (shape === 'endEvent') {
      return (
        <div className="end-event-circle-inner">
          <div className="event-inner">{children}</div>
        </div>
      );
    }

    if (shape === 'database') {
      return <div className="database-text">{children}</div>;
    }

    if (shape === 'documents') {
      return (
        <>
          <div className="documents-bg-back"></div>
          <div className="documents-bg-middle"></div>
          <div className="documents-front">{children}</div>
        </>
      );
    }

    if ([
      'hexagon',
      'parallelogram',
      'parallelogramAlt',
      'trapezoid',
      'trapezoidAlt',
      'asymmetric',
    ].includes(shape)) {
      return (
        <>
          <div className={`${shape}-bg`}></div>
          <div className={`${shape}-text`}>{children}</div>
        </>
      );
    }

    // Default legacy containers (process, rounded, stadium, file, subroutine)
    return <>{children}</>;
  }

  // Render new shapes using pure-SVG viewport scaling
  let svgContent: React.ReactNode;

  switch (shape) {
    case 'bang':
      svgContent = (
        <polygon
          points="50,2 62,35 95,25 78,55 98,75 66,75 50,98 34,75 2,75 22,55 5,25 38,35"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'card':
      svgContent = (
        <path
          d="M2,2 L80,2 L98,20 L98,98 L2,98 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'cloud':
      svgContent = (
        <path
          d="M25,60 C15,60 10,50 15,40 C10,30 25,15 40,25 C50,10 75,10 80,25 C95,20 98,40 90,50 C98,60 90,75 80,70 C75,85 50,85 40,75 C25,85 20,75 25,60 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'collate':
      svgContent = (
        <path
          d="M10,10 L90,10 L50,50 L90,90 L10,90 L50,50 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'comLink':
      svgContent = (
        <polygon
          points="60,2 10,55 50,55 40,98 90,45 50,45"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'comment':
      svgContent = (
        <path
          d="M80,5 C40,5 30,10 30,50 C30,90 40,95 80,95 M30,50 L5,50"
          fill="none"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'commentRight':
      svgContent = (
        <path
          d="M20,5 C60,5 70,10 70,50 C70,90 60,95 20,95 M70,50 L95,50"
          fill="none"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'commentBoth':
      svgContent = (
        <path
          d="M30,5 C10,5 5,10 5,50 C5,90 10,95 30,95 M70,5 C90,5 95,10 95,50 C95,90 90,95 70,95"
          fill="none"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'dataStore':
      svgContent = (
        <path
          d="M98,5 L2,5 L2,95 L98,95"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'delay':
      svgContent = (
        <path
          d="M2,15 L50,15 A35,35 0 0,1 50,85 L2,85 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'directAccessStorage':
      svgContent = (
        <>
          <path
            d="M15,15 L85,15 A15,35 0 0,1 85,85 L15,85 A15,35 0 0,1 15,15 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <path d="M15,15 A15,35 0 0,1 15,85" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <path d="M85,15 A15,35 0 0,1 85,85" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'diskStorage':
      svgContent = (
        <>
          <path
            d="M15,15 A35,10 0 0,1 85,15 L85,85 A35,10 0 0,1 15,85 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <ellipse cx="50" cy="15" rx="35" ry="10" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <path d="M15,38 A35,10 0 0,0 85,38" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <path d="M15,62 A35,10 0 0,0 85,62" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'display':
      svgContent = (
        <path
          d="M2,50 C15,15 30,15 50,15 L98,15 L80,50 L98,85 L50,85 C30,85 15,85 2,50 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'dividedProcess':
      svgContent = (
        <>
          <rect x="2" y="15" width="96" height="70" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="2" y1="35" x2="98" y2="35" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'extract':
      svgContent = (
        <polygon
          points="50,5 98,90 2,90"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'forkJoin':
      svgContent = (
        <rect
          x="42"
          y="2"
          width="16"
          height="96"
          fill="var(--node-border-color, var(--border-color))"
        />
      );
      break;

    case 'internalStorage':
      svgContent = (
        <>
          <rect x="2" y="15" width="96" height="70" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="30" y1="15" x2="30" y2="85" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="2" y1="50" x2="98" y2="50" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'junction':
      svgContent = (
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="var(--node-border-color, var(--border-color))"
        />
      );
      break;

    case 'linedDocument':
      svgContent = (
        <>
          <path
            d="M2,2 L70,2 L98,30 L98,98 L2,98 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <path d="M70,2 L70,30 L98,30" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="15" y1="45" x2="85" y2="45" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="15" y1="60" x2="85" y2="60" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="15" y1="75" x2="65" y2="75" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'loopLimit':
      svgContent = (
        <polygon
          points="2,15 98,15 98,60 75,85 25,85 2,60"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'manualFile':
      svgContent = (
        <>
          <path
            d="M2,2 L98,2 L98,70 L70,98 L2,98 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <path d="M98,70 L70,70 L70,98" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'manualInput':
      svgContent = (
        <polygon
          points="2,30 98,5 98,95 2,95"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'multiProcess':
      svgContent = (
        <>
          <rect x="15" y="2" width="80" height="75" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <rect x="2" y="20" width="80" height="75" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'paperTape':
      svgContent = (
        <path
          d="M2,15 C20,5 50,25 98,15 L98,75 C50,85 20,65 2,75 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'storedData':
      svgContent = (
        <path
          d="M2,15 L98,15 C85,30 85,70 98,85 L2,85 C15,70 15,30 2,15 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'summary':
      svgContent = (
        <>
          <circle cx="50" cy="50" r="40" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="22" y1="22" x2="78" y2="78" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="78" y1="22" x2="22" y2="78" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'taggedDocument':
      svgContent = (
        <>
          <path
            d="M2,2 L70,2 L98,30 L98,98 L2,98 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <path d="M70,2 L70,30 L98,30" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <circle cx="35" cy="30" r="8" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'taggedProcess':
      svgContent = (
        <>
          <rect x="2" y="15" width="96" height="70" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <circle cx="20" cy="35" r="6" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'textBlock':
      svgContent = (
        <rect x="2" y="15" width="96" height="70" rx="4" fill="none" stroke="none" />
      );
      break;

    case 'odd':
      svgContent = (
        <polygon
          points="15,15 85,15 98,50 85,85 15,85 2,50"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    default:
      svgContent = (
        <rect
          x="2"
          y="15"
          width="96"
          height="70"
          rx="4"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;
  }

  // Wrapper for new shapes providing absolute backdrop and centered label content
  return (
    <div
      className={`new-shape-container shape-${shape}-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {svgContent}
      </svg>
      <div
        className={`new-shape-label-wrapper`}
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '4px 8px',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Enable pointer-events on the actual child label (editing input or text element) */}
        <div style={{ pointerEvents: 'auto', width: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
