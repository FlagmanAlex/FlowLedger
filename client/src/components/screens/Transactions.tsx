import { Form } from 'react-router-dom';

export function Transactions() {
  return (
    <div>
      <h1>Transactions</h1>
      <Form method="post">
        <input type="text" name="description" placeholder="Description" />
        <input type="number" name="amount" placeholder="Amount" />
        <button type="submit">Add</button>
      </Form>
    </div>
  );
}
