'use client';
/** CSS perspective model: no WebGL, textures, GPU allocations or animation loop. */
export default function LaundryAccentScene({ playing }: { playing: boolean }) {
  return (
    <div className="care-model" data-playing={playing} aria-hidden="true">
      <div className="care-machine">
        <div className="care-machine-top" />
        <div className="care-console">
          <i />
          <b>SS</b>
          <span>FABRIC CARE</span>
        </div>
        <div className="care-door">
          <div className="care-drum">
            <i />
            <i />
            <i />
          </div>
          <div className="care-glass" />
        </div>
        <div className="care-base" />
      </div>
      <div className="care-towels">
        <i />
        <i />
        <i />
      </div>
      <span className="care-spark">✦</span>
    </div>
  );
}
