// From storybookjs/storybook code/renderers/react/template/stories/errors.stories.tsx (MIT): React cannot render an object.
const badOutput = { renderable: 'no, react can not render objects' };
export const BadComponent = () => badOutput as any;
