import { encoderMap } from '../feature-meta';

export type PartialButNotUndefined<T> = {
  [P in keyof T]: T[P];
};

export const supportedEncoderMapP: Promise<
  PartialButNotUndefined<typeof encoderMap>
> = (async () => {
  const supportedEncoderMap: PartialButNotUndefined<typeof encoderMap> = {
    ...encoderMap,
  };

  // Filter out entries where the feature test fails
  await Promise.all(
    Object.entries(encoderMap).map(async ([encoderName, details]) => {
      if ('featureTest' in details && !(await details.featureTest())) {
        delete supportedEncoderMap[encoderName as keyof typeof encoderMap];
      }
    }),
  );

  return supportedEncoderMap;
})();
