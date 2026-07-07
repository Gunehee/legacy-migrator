import React from 'react';
import { connect } from 'react-redux';
import { addTodo } from './store';

class TodoList extends React.Component {
  constructor(props) {
    super(props);
    this.state = { text: '' };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(ev) {
    this.setState({ text: ev.target.value });
  }

  handleSubmit(ev) {
    ev.preventDefault();
    if (!this.state.text) {
      return;
    }
    this.props.onAddTodo(this.state.text);
    this.setState({ text: '' });
  }

  render() {
    return (
      <div className="todo-list">
        <form onSubmit={this.handleSubmit}>
          <input value={this.state.text} onChange={this.handleChange} />
          <button type="submit">Add</button>
        </form>
        <ul>
          {this.props.todos.map((todo, i) => (
            <li key={i}>{todo}</li>
          ))}
        </ul>
      </div>
    );
  }
}

const mapStateToProps = state => ({ todos: state.todos });
const mapDispatchToProps = dispatch => ({
  onAddTodo: text => dispatch(addTodo(text))
});

export default connect(mapStateToProps, mapDispatchToProps)(TodoList);
