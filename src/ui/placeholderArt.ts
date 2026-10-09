import {
  vehicleBodyHeightU,
  vehicleShapes,
  type ShapedVehicle,
} from '../content/placeholderShapes.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** DOM preview of a vehicle from the same placeholder shapes as the ride. */
export function vehicleSvg(
  vehicle: ShapedVehicle,
  pixelsPerU: number,
): SVGSVGElement {
  const wheelSpace = vehicle.wheelRadiusU * 2;
  const height = vehicleBodyHeightU(vehicle) + wheelSpace;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${vehicle.lengthU} ${height}`);
  svg.setAttribute('width', String(Math.round(vehicle.lengthU * pixelsPerU)));
  svg.setAttribute('height', String(Math.round(height * pixelsPerU)));
  svg.setAttribute('aria-hidden', 'true');
  const bodyBottom = height - wheelSpace * 0.65;
  for (const shape of vehicleShapes(vehicle)) {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute(
      'points',
      shape.points.map(([x, y]) => `${x},${bodyBottom - y}`).join(' '),
    );
    polygon.setAttribute('fill', shape.color);
    svg.append(polygon);
  }
  for (const x of [
    vehicle.lengthU / 2 - vehicle.bogieOffsetU,
    vehicle.lengthU / 2 + vehicle.bogieOffsetU,
  ]) {
    const wheel = document.createElementNS(SVG_NS, 'circle');
    wheel.setAttribute('cx', String(x));
    wheel.setAttribute('cy', String(height - vehicle.wheelRadiusU));
    wheel.setAttribute('r', String(vehicle.wheelRadiusU));
    wheel.setAttribute('fill', '#222');
    svg.append(wheel);
  }
  return svg;
}
