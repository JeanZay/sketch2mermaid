import React from 'react';
import type { NodeShape } from '../../core/types';
import { LEGACY_NODE_SHAPES, shapeSupportsLabel } from '../../core/shapeRegistry';

export interface NodeShapeRendererProps {
  shape: NodeShape;
  className?: string;
  children: React.ReactNode;
}

export const NodeShapeRenderer = ({
  shape,
  className = '',
  children,
}: NodeShapeRendererProps) => {
  const isLegacyShape = LEGACY_NODE_SHAPES.has(shape) && shape !== 'asymmetric';

  if (shape === 'comment') {
    return (
      <div
        className={`new-shape-container shape-comment-container ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          boxSizing: 'border-box',
          padding: '4px 8px 4px 14px',
        }}
      >
        <svg
          viewBox="0 0 10 80"
          style={{
            position: 'absolute',
            left: '6px',
            top: '10%',
            height: '80%',
            width: '10px',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <path
            d="M 8,2 Q 2,2 2,12 L 2,34 Q 2,40 0,40 Q 2,40 2,46 L 2,68 Q 2,78 8,78"
            fill="none"
            stroke="var(--node-border-color, #9370DB)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div
          className="new-shape-label-wrapper"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ pointerEvents: 'auto', width: '100%' }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (shape === 'commentRight') {
    return (
      <div
        className={`new-shape-container shape-commentRight-container ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          boxSizing: 'border-box',
          padding: '4px 14px 4px 8px',
        }}
      >
        <div
          className="new-shape-label-wrapper"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ pointerEvents: 'auto', width: '100%' }}>
            {children}
          </div>
        </div>
        <svg
          viewBox="0 0 10 80"
          style={{
            position: 'absolute',
            right: '6px',
            top: '10%',
            height: '80%',
            width: '10px',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <path
            d="M 2,2 Q 8,2 8,12 L 8,34 Q 8,40 10,40 Q 8,40 8,46 L 8,68 Q 8,78 2,78"
            fill="none"
            stroke="var(--node-border-color, #9370DB)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (shape === 'commentBoth') {
    return (
      <div
        className={`new-shape-container shape-commentBoth-container ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          boxSizing: 'border-box',
          padding: '4px 18px 4px 18px',
        }}
      >
        <svg
          viewBox="0 0 10 80"
          style={{
            position: 'absolute',
            left: '6px',
            top: '10%',
            height: '80%',
            width: '10px',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <path
            d="M 8,2 Q 2,2 2,12 L 2,34 Q 2,40 0,40 Q 2,40 2,46 L 2,68 Q 2,78 8,78"
            fill="none"
            stroke="var(--node-border-color, #9370DB)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <div
          className="new-shape-label-wrapper"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ pointerEvents: 'auto', width: '100%' }}>
            {children}
          </div>
        </div>
        <svg
          viewBox="0 0 10 80"
          style={{
            position: 'absolute',
            right: '6px',
            top: '10%',
            height: '80%',
            width: '10px',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <path
            d="M 2,2 Q 8,2 8,12 L 8,34 Q 8,40 10,40 Q 8,40 8,46 L 8,68 Q 8,78 2,78"
            fill="none"
            stroke="var(--node-border-color, #9370DB)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

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



    if ([
      'hexagon',
      'parallelogram',
      'parallelogramAlt',
      'trapezoid',
      'trapezoidAlt',
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
        <path
          d="M8,20 a11.5,11.5 1 0,0 19.1,-5.9 a11.5,11.5 1 0,0 19.1,0 a11.5,11.5 1 0,0 19.1,0 a11.5,11.5 1 0,0 19.1,5.9 a11.5,11.5 1 0,0 11.5,19.4 a9.2,9.2 1 0,0 0,20.0 a11.5,11.5 1 0,0 -11.5,19.4 a11.5,11.5 1 0,0 -19.1,8.8 a11.5,11.5 1 0,0 -19.1,0 a11.5,11.5 1 0,0 -19.1,0 a11.5,11.5 1 0,0 -19.1,-8.8 a11.5,11.5 1 0,0 -7.6,-19.4 a9.2,9.2 1 0,0 0,-20.0 a11.5,11.5 1 0,0 7.6,-19.4 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'card':
      svgContent = (
        <path
          d="M98,2 L20,2 L2,20 L2,98 L98,98 Z"
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



    case 'dataStore':
      svgContent = (
        <>
          <rect x="2" y="5" width="96" height="90" fill="var(--node-bg-color, #ffffff)" stroke="none" />
          <line x1="2" y1="5" x2="98" y2="5" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="2" y1="95" x2="98" y2="95" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
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
            d="M7,15 L93,15 A4,35 0 0,1 93,85 L7,85 A4,35 0 0,1 7,15 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <path d="M93,15 A4,35 0 0,0 93,85" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'diskStorage':
      svgContent = (
        <>
          <path
            d="M15,15 L85,15 L85,85 A35,10 0 0,1 15,85 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <ellipse cx="50" cy="15" rx="35" ry="10" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <path d="M15,22 A35,10 0 0,0 85,22" fill="none" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'display':
      svgContent = (
        <path
          d="M20,15 L10,50 L20,85 L75,85 C88,85 98,70 98,50 C98,30 88,15 75,15 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'documents':
      svgContent = (
        <>
          {/* Back Sheet */}
          <path
            d="M18,2 L96,2 L96,70 C76,62 38,78 18,70 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          {/* Middle Sheet */}
          <path
            d="M10,8 L88,8 L88,78 C68,70 30,86 10,78 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          {/* Front Sheet */}
          <path
            d="M2,14 L80,14 L80,86 C60,78 22,94 2,86 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
        </>
      );
      break;

    case 'dividedProcess':
      svgContent = (
        <>
          <rect x="2" y="15" width="96" height="70" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="2" y1="26.6" x2="98" y2="26.6" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
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
          x="0"
          y="0"
          width="100"
          height="100"
          fill="var(--node-border-color, var(--border-color))"
          stroke="none"
        />
      );
      break;

    case 'internalStorage':
      svgContent = (
        <>
          <rect x="2" y="15" width="96" height="70" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="6.5" y1="15" x2="6.5" y2="85" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <line x1="2" y1="26.6" x2="98" y2="26.6" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
        </>
      );
      break;

    case 'junction':
      svgContent = (
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="var(--node-border-color, var(--border-color))"
        />
      );
      break;

    case 'linedDocument':
      svgContent = (
        <>
          <path
            d="M2,15 L98,15 L98,80 C70,65 30,95 2,80 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <line
            x1="6"
            y1="15"
            x2="6"
            y2="81.5"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
        </>
      );
      break;

    case 'loopLimit':
      svgContent = (
        <polygon
          points="2,95 2,21 25,5 75,5 98,21 98,95"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'file':
      svgContent = (
        <path
          d="M5,5 L95,5 L95,85 C70,70 30,100 5,85 Z"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
      );
      break;

    case 'manualFile':
      svgContent = (
        <polygon
          points="5,10 95,10 50,95"
          fill="var(--node-bg-color, #ffffff)"
          stroke="var(--node-border-color, var(--border-color))"
          strokeWidth="2"
        />
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
          <rect x="20" y="2" width="78" height="72" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <rect x="11" y="14" width="78" height="72" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
          <rect x="2" y="26" width="78" height="72" rx="4" fill="var(--node-bg-color, #ffffff)" stroke="var(--node-border-color, var(--border-color))" strokeWidth="2" />
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
          d="M17,15 L98,15 C83,30 83,70 98,85 L17,85 C2,70 2,30 17,15 Z"
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
            d="M2,15 L98,15 L98,80 C70,70 30,90 2,80 Z"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <polygon
            points="98,80 83,78 98,65"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
        </>
      );
      break;

    case 'taggedProcess':
      svgContent = (
        <>
          <rect
            x="2"
            y="15"
            width="96"
            height="70"
            rx="0"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
          <polygon
            points="98,85 82,85 98,69"
            fill="var(--node-bg-color, #ffffff)"
            stroke="var(--node-border-color, var(--border-color))"
            strokeWidth="2"
          />
        </>
      );
      break;

    case 'textBlock':
      svgContent = (
        <rect x="2" y="15" width="96" height="70" rx="4" fill="none" stroke="none" />
      );
      break;

    case 'asymmetric':
    case 'odd':
      svgContent = (
        <polygon
          points="2,15 98,15 98,85 2,85 20,50"
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
      {shapeSupportsLabel(shape) && (
        <div
          className={`new-shape-label-wrapper`}
          style={{
            position: ['documents', 'manualFile', 'forkJoin', 'asymmetric', 'odd', 'dividedProcess', 'multiProcess', 'internalStorage'].includes(shape) ? 'absolute' : 'relative',
            left: shape === 'documents' ? '2%' : (shape === 'manualFile' ? '10%' : (shape === 'forkJoin' ? '50%' : (['asymmetric', 'odd'].includes(shape) ? '18%' : (shape === 'dividedProcess' ? '2%' : (shape === 'multiProcess' ? '2%' : (shape === 'internalStorage' ? '6.5%' : undefined)))))),
            top: shape === 'documents' ? '14%' : (shape === 'manualFile' ? '10%' : (shape === 'forkJoin' ? '50%' : (['asymmetric', 'odd'].includes(shape) ? '15%' : (shape === 'dividedProcess' ? '26.6%' : (shape === 'multiProcess' ? '26%' : (shape === 'internalStorage' ? '26.6%' : undefined)))))),
            width: shape === 'documents' ? '78%' : (shape === 'manualFile' ? '80%' : (shape === 'forkJoin' ? '150px' : (['asymmetric', 'odd'].includes(shape) ? '80%' : (shape === 'dividedProcess' ? '96%' : (shape === 'multiProcess' ? '78%' : (shape === 'internalStorage' ? '91.5%' : '100%')))))),
            height: shape === 'documents' ? '72%' : (shape === 'manualFile' ? '35%' : (shape === 'forkJoin' ? '40px' : (['asymmetric', 'odd'].includes(shape) ? '70%' : (shape === 'dividedProcess' ? '58.4%' : (shape === 'multiProcess' ? '72%' : (shape === 'internalStorage' ? '58.4%' : '100%')))))),
            transform: shape === 'forkJoin' ? 'translate(-50%, -50%)' : undefined,
            zIndex: 1,
            padding: '4px 8px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: shape === 'dividedProcess' ? 'flex-end' : 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Enable pointer-events on the actual child label (editing input or text element) */}
          <div style={{ pointerEvents: 'auto', width: '100%' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
