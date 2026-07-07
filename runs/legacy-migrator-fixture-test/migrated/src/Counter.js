import React from 'react';
import { connect } from 'react-redux';
import { increment, decrement } from './store';

class Counter extends React.Component {
  render() {
    return (
      <div className="counter">
        <button onClick={this.props.onDecrement}>-</button>
        <span>{this.props.count}</span>
        <button onClick={this.props.onIncrement}>+</button>
      </div>
    );
  }
}

const mapStateToProps = state => ({ count: state.counter });
const mapDispatchToProps = dispatch => ({
  onIncrement: () => dispatch(increment()),
  onDecrement: () => dispatch(decrement())
});

export default connect(mapStateToProps, mapDispatchToProps)(Counter);
