import { line, area, curveMonotoneX } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { select } from 'd3-selection';
import 'd3-transition';

interface SparklineOptions {
  width?: number;
  height?: number;
  maxPoints?: number;
  color?: string;
}

const TRANSITION_MS = 300;

export class Sparkline {
  private svg: SVGSVGElement;
  private data: number[] = [];
  private maxPoints: number;
  private width: number;
  private height: number;
  private color: string;

  constructor(container: HTMLElement, options?: SparklineOptions) {
    this.width = options?.width ?? 60;
    this.height = options?.height ?? 20;
    this.maxPoints = options?.maxPoints ?? 20;
    this.color = options?.color ?? 'var(--accent)';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.svg.style.overflow = 'visible';

    // Area fill path (rendered below line)
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaPath.classList.add('sparkline-area');
    areaPath.setAttribute('fill', this.color);
    areaPath.setAttribute('fill-opacity', '0.15');
    areaPath.setAttribute('stroke', 'none');
    this.svg.appendChild(areaPath);

    // Line path
    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linePath.classList.add('sparkline-line');
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', this.color);
    linePath.setAttribute('stroke-width', '1.5');
    linePath.setAttribute('stroke-linecap', 'round');
    linePath.setAttribute('stroke-linejoin', 'round');
    this.svg.appendChild(linePath);

    container.appendChild(this.svg);
  }

  pushValue(value: number): void {
    this.data.push(value);
    if (this.data.length > this.maxPoints) this.data.shift();
    this.redraw();
  }

  setColor(color: string): void {
    this.color = color;
    this.svg.querySelector('.sparkline-line')?.setAttribute('stroke', color);
    this.svg.querySelector('.sparkline-area')?.setAttribute('fill', color);
  }

  private redraw(): void {
    // Pad single point to avoid degenerate path
    const points = this.data.length < 2
      ? [this.data[0], this.data[0]]
      : this.data;

    const x = scaleLinear()
      .domain([0, points.length - 1])
      .range([0, this.width]);

    const min = Math.min(...points);
    const max = Math.max(...points);
    const padding = max === min ? 1 : 0;
    const y = scaleLinear()
      .domain([min - padding, max + padding])
      .range([this.height - 1, 1]);

    const lineGen = line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(curveMonotoneX);

    const areaGen = area<number>()
      .x((_, i) => x(i))
      .y0(this.height)
      .y1((d) => y(d))
      .curve(curveMonotoneX);

    const lineD = lineGen(points) ?? '';
    const areaD = areaGen(points) ?? '';

    const svgSel = select(this.svg);
    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      svgSel.select('.sparkline-line').attr('d', lineD);
      svgSel.select('.sparkline-area').attr('d', areaD);
    } else {
      svgSel.select('.sparkline-line')
        .transition().duration(TRANSITION_MS)
        .attr('d', lineD);
      svgSel.select('.sparkline-area')
        .transition().duration(TRANSITION_MS)
        .attr('d', areaD);
    }
  }

  destroy(): void {
    this.svg.remove();
  }
}
