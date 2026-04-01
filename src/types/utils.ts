export type DeepImmutable<T> = T extends (...args: any[]) => any
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepImmutable<K>, DeepImmutable<V>>
    : T extends Set<infer U>
      ? ReadonlySet<DeepImmutable<U>>
      : T extends Array<infer U>
        ? ReadonlyArray<DeepImmutable<U>>
        : T extends object
          ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
          : T

type BuildTuple<
  L extends number,
  T extends readonly unknown[] = [],
> = T['length'] extends L ? T : BuildTuple<L, readonly [T['length'], ...T]>

type PermuteTuple<T extends readonly unknown[]> = T['length'] extends 0
  ? []
  : {
      [K in keyof T]: [T[K], ...PermuteTuple<ExcludeIndex<T, K>>]
    }[number]

type ExcludeIndex<
  T extends readonly unknown[],
  K extends keyof T,
> = T extends readonly [...infer R]
  ? {
      [I in keyof R]: I extends K ? never : R[I]
    } extends infer O
    ? O extends readonly unknown[]
      ? FilterNever<O>
      : []
    : []
  : []

type FilterNever<T extends readonly unknown[]> = T extends readonly [
  infer H,
  ...infer R,
]
  ? H extends never
    ? FilterNever<R>
    : readonly [H, ...FilterNever<R>]
  : []

export type Permutations<N extends number> = PermuteTuple<BuildTuple<N>>
