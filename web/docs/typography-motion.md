# Typography and motion

Fortify uses **Archivo** for the brand voice, headings and primary actions, with **Inter Tight** for supporting copy and dense workspace controls. Archivo is self-hosted as a Latin WOFF2 subset of the variable upright and italic fonts. The original open font license is retained at `public/fonts/archivo/OFL.txt`.

The user's visual reference was Typodermic's Naked Power. Its free desktop files do not permit website embedding, so Archivo is the approved open-license substitute. If Fortify later licenses Naked Power for web embedding, replace the Archivo files and update `@font-face` in `app/fortify-finish.css` after checking the exact license terms.

The marketing page has two 3D scenes: the connected signal in both hero themes, and context-to-plan-to-action slabs by the final call to action. Their canvas code loads only when the relevant section approaches the viewport. Animation stops offscreen, when the tab is hidden, when the site's motion control is paused, and for reduced-motion or reduced-effects visits. Both scenes retain a still fallback if WebGL is unavailable.

The homepage story uses open, ruled rows for the tool replacements and feature list. Product previews retain their frames so they read as examples of the interface rather than another row of generic cards.

Buttons acknowledge hover with a short surface light and lift, then press downward on click. Keyboard focus remains visible; reduced-motion visits retain color and focus feedback without spatial motion.
