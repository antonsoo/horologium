# Third-party notices

The new-moon phase series in `src/lib/astronomy/calendar-events.ts` adapts
the Meeus chapter 49 implementation by Sonia Keys and Commenthol in
[astronomia](https://github.com/commenthol/astronomia/blob/master/src/moonphase.js).
The first and seventh additional angular constants and the first angle's
quadratic term follow the chapter 49 values (299.77, 207.14, and degrees).
The longitude terms, mean arguments and additive corrections in
`src/lib/astronomy/moon-longitude.ts` adapt the longitude portion of their
[`moonposition.js` implementation](https://github.com/commenthol/astronomia/blob/71e16c942b143a1a5a067b6aab2d8532064704ae/src/moonposition.js).
Its latitude and distance series are not included. These adaptations add no
runtime package dependency.

The MIT License (MIT)

Copyright (c) 2013 Sonia Keys
Copyright (c) 2016 Commenthol

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Planetary elements and validation data

The numeric orbital elements and mean-anomaly correction coefficients in
`src/lib/astronomy/planets.ts` come from Tables 1, 2a and 2b of JPL Solar
System Dynamics, [Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html),
which credits E.M. Standish and J.G. Williams (1992). These are approximate
fitted elements, not an integrated ephemeris. The source's nominal errors
refer to heliocentric coordinates.

The independent study retains responses from the NASA/JPL Horizons API,
using its DE441 planetary ephemeris, and rotates those vectors with ERFA.
The API URLs, settings and raw-response hashes are in
`studies/long-range-planets/sources.json`. No NASA/JPL endorsement is implied.
ERFA is used only to produce validation fixtures, not bundled at runtime.
