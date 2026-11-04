// Vite's `?raw` imports: a file's text as a string (used to read the sample
// parcel CSV without Node's fs types)
declare module "*?raw" {
  const text: string;
  export default text;
}
