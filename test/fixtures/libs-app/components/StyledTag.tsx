import styled from "styled-components";

const Tag = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  color: white;
  background: ${(p) => p.theme.accent};
`;

export function StyledTag({ text }: { text: string }) {
  return <Tag>{text}</Tag>;
}
