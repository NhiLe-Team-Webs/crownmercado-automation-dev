declare module 'react/jsx-runtime' {
  import type * as React from 'react';
  export namespace JSX {
    interface Element extends React.JSX.Element {}
    interface ElementClass extends React.JSX.ElementClass {}
    interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
  export const Fragment: React.ExoticComponent<{ children?: React.ReactNode }>;
  export function jsx(type: React.ElementType, props: unknown, key?: React.Key): React.ReactElement;
  export function jsxs(type: React.ElementType, props: unknown, key?: React.Key): React.ReactElement;
}
