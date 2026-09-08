# Portfolio illustration

Mode: built-in image_gen tool, one new illustration followed by background edits. No CLI/API fallback.

Final assets:
- `public/images/coder-doodle.png`: original selected PNG, 1254 × 1254.
- `public/images/coder-doodle.webp`: optimized website asset, 1000 × 1000, 134098 bytes.

The generator returned RGB output with a painted checkerboard despite requesting alpha. The selected final image uses a plain ivory background matching the website instead; it is not transparent. Character, face, full seated pose, laptop, and no-glasses requirement were visually checked. The WebP was created with Sharp (quality 86, effort 6); the original PNG is retained.

## Generation prompt

Use case: illustration-story
Asset type: transparent bitmap hero illustration for a personal developer portfolio.
Primary request: one distinctive editorial manga/anime black ink doodle of a friendly young Indian male coder.
Scene/backdrop: genuinely transparent background with preserved alpha; isolated character, no surroundings.
Subject: young Indian man with tousled short dark hair, no glasses or spectacles, clean shaven; wearing a simple off-white tee with one tiny muted red accent. Seated cross-legged with an open laptop resting on his lap; head tilted slightly forward toward the viewer; confident, relaxed smile.
Style/medium: tasteful hand-drawn manga doodle, energetic expressive black ink outlines with restrained halftone shading, editorial illustration.
Composition/framing: full body, centered subject filling a square canvas, both feet fully visible, clear natural anatomy and hands.
Color palette: primarily black, white, and ivory; one vermilion red #ee4935 laptop sticker. To sit on a website with paper #faf8f2 and ink #232323.
Constraints: no eyeglasses or sunglasses anywhere; no text; no logos; no watermark; no surroundings; no background fill; no shadow rectangle; preserve actual transparency.

## Final background edit prompt

Use case: precise-object-edit
Asset type: developer portfolio hero illustration.
Change ONLY the background of the supplied illustration: replace all gray/white checkerboard squares with a completely flat, solid, uniform warm ivory color #faf8f2. No texture in the background, no checkerboard, no shadow, no gradient, no outlines or decorative marks outside the character. Preserve the coder character, exact face and friendly smile, dark tousled hair, no glasses, tee, cross-legged full-body pose and both shoes, laptop and red heart sticker, black ink anime illustration unchanged. The finished image must be the same composition on entirely plain warm ivory #faf8f2 background.

