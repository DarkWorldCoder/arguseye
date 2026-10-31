// From storybookjs/storybook code/renderers/react/template/stories/hooks.stories.tsx (MIT).
import type { FC } from 'react';
import React, { useState } from 'react';

export const ButtonWithState: FC = () => {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {`count: ${count}`}
    </button>
  );
};
