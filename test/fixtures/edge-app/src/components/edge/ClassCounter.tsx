import { Component } from "react";
export default class ClassCounter extends Component<{ start: number }, { n: number }> {
  state = { n: this.props.start };
  render() { return <button onClick={() => this.setState({ n: this.state.n + 1 })}>Class count {this.state.n}</button>; }
}
