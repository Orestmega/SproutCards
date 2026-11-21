import { render } from '@testing-library/react';
import { GardenScene } from './GardenScene';
import { makeGardenArt } from './gardenArt';

describe('makeGardenArt', () => {
  it('makes the same picture every time', () => {
    expect(makeGardenArt()).toEqual(makeGardenArt());
  });

  it('puts the grass, flowers and bushes on the hills, inside the picture', () => {
    const art = makeGardenArt();
    expect(art.bushes).toHaveLength(7);
    expect(art.clumps).toHaveLength(44);
    expect(art.wildflowers).toHaveLength(22);
    for (const item of [...art.bushes, ...art.clumps, ...art.wildflowers]) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      // the front hill's curve bulges a little past the right edge (as in the design)
      expect(item.x).toBeLessThanOrEqual(410);
      // below the highest hill top, above the bottom edge
      expect(item.y).toBeGreaterThan(100);
      expect(item.y).toBeLessThanOrEqual(240);
    }
    expect(art.fringe.every((d) => d.startsWith('M') && d.length > 1000)).toBe(true);
  });
});

describe('GardenScene', () => {
  const flower = { stage: 'bloom' as const, variety: 'daisy' as const };

  it('shows the dug bed on Home while nothing grows, and the flowers once one is planted', () => {
    const { container, rerender } = render(<GardenScene part="afternoon" plants={[]} startBed />);
    expect(container.querySelector('.garden__bed')).not.toBeNull();
    rerender(<GardenScene part="afternoon" plants={[null, flower]} startBed />);
    expect(container.querySelector('.garden__bed')).toBeNull();
    expect(container.querySelectorAll('.garden__plant')).toHaveLength(1);
  });

  it('the garden screen has no bed: its empty plots can be tapped', () => {
    const { container } = render(
      <GardenScene part="afternoon" plants={[]} onPlot={() => undefined} big />,
    );
    expect(container.querySelector('.garden__bed')).toBeNull();
    expect(container.querySelectorAll('.garden__plot--empty')).toHaveLength(15);
  });

  it('birds fly by day; fireflies, the moon and a shooting star come at night', () => {
    const day = render(<GardenScene part="morning" plants={[]} />);
    expect(day.container.querySelector('.garden__birds')).not.toBeNull();
    expect(day.container.querySelector('.garden__sun')).not.toBeNull();
    expect(day.container.querySelector('.garden__fly')).toBeNull();
    day.unmount();

    const night = render(<GardenScene part="night" plants={[]} />);
    expect(night.container.querySelector('.garden__birds')).toBeNull();
    expect(night.container.querySelector('.garden__moon')).not.toBeNull();
    expect(night.container.querySelectorAll('.garden__fly')).toHaveLength(12);
    expect(night.container.querySelector('.garden__shoot')).not.toBeNull();

    // the evening already has fireflies, but still the setting sun
    const evening = render(<GardenScene part="evening" plants={[]} />);
    expect(evening.container.querySelector('.garden__sun')).not.toBeNull();
    expect(evening.container.querySelector('.garden__fly')).not.toBeNull();
  });

  it('two pictures on one page do not share gradient ids', () => {
    const { container } = render(
      <>
        <GardenScene part="afternoon" plants={[]} />
        <GardenScene part="afternoon" plants={[]} />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
