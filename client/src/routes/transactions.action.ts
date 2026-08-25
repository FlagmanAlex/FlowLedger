import type { ActionFunctionArgs } from 'react-router-dom';

export async function transactionsAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const description = formData.get('description');
  const amount = formData.get('amount');

  // TODO: send transaction to server API
  console.log('New transaction submitted:', { description, amount });

  return null;
}
