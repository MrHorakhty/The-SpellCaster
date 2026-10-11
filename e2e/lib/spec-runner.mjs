// Shared spec runner. The entrypoints (e2e-full.mjs, e2e-mobile.mjs) decide
// WHERE a shared spec runs so the ordering they rely on is preserved; each spec
// stays self-contained (it seeds its own fixture and reloads), so both
// platforms can run the identical code.

export async function runSpecs(ctx, specs) {
  for (const spec of specs) {
    if (spec.title) console.log(`\n[${ctx.label}] === ${spec.title} ===`);
    await spec.run(ctx);
  }
}