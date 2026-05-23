
export function resolve(spec, ctx, next) {
  if (/^.{1,2}//.test(spec) && !/.[a-z]+$/.test(spec)) {
    return next(spec + '.ts', ctx);
  }
  return next(spec, ctx);
}
