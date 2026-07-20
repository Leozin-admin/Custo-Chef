/* Dados fictícios para o modo demonstração (?demo=1) */

const DEMO_RESTAURANTE = {
  id: 999,
  nome: 'Restaurante Demonstração',
  plano: 'pro',
  email: 'demo@custochef.com',
  telefone: '',
  cnpj: '',
  endereco: ''
};

const DEMO_INGREDIENTES = [
  { id: 1, nome: 'Frango', unidade: 'kg', precoPorUnidade: 18.90, estoqueAtual: 25, estoqueMinimo: 5, categoria: 'Carnes', fornecedor: { nome: 'Avícola Bom Preço' }, fornecedorId: 1 },
  { id: 2, nome: 'Arroz', unidade: 'kg', precoPorUnidade: 6.50, estoqueAtual: 40, estoqueMinimo: 10, categoria: 'Grãos', fornecedor: { nome: 'Distribuidora Central' }, fornecedorId: 2 },
  { id: 3, nome: 'Tomate', unidade: 'kg', precoPorUnidade: 8.20, estoqueAtual: 3, estoqueMinimo: 5, categoria: 'Hortifruti', fornecedor: { nome: 'Hortifruti Verde' }, fornecedorId: 3 },
  { id: 4, nome: 'Queijo Mussarela', unidade: 'kg', precoPorUnidade: 34.90, estoqueAtual: 12, estoqueMinimo: 3, categoria: 'Laticínios', fornecedor: { nome: 'Laticínios Serra' }, fornecedorId: 4 },
  { id: 5, nome: 'Farinha de Trigo', unidade: 'kg', precoPorUnidade: 5.10, estoqueAtual: 30, estoqueMinimo: 8, categoria: 'Grãos', fornecedor: null, fornecedorId: null }
];

const DEMO_FORNECEDORES = [
  { id: 1, nome: 'Avícola Bom Preço', contato: 'Carlos', telefone: '(11) 98888-1111', email: 'carlos@avicola.com', ingredientes: [{ id: 1 }] },
  { id: 2, nome: 'Distribuidora Central', contato: 'Marina', telefone: '(11) 97777-2222', email: 'marina@distribuidora.com', ingredientes: [{ id: 2 }] },
  { id: 3, nome: 'Hortifruti Verde', contato: 'Pedro', telefone: '(11) 96666-3333', email: 'pedro@hortifruti.com', ingredientes: [{ id: 3 }] },
  { id: 4, nome: 'Laticínios Serra', contato: 'Julia', telefone: '(11) 95555-4444', email: 'julia@laticinios.com', ingredientes: [{ id: 4 }] }
];

const DEMO_PRATOS = [
  {
    id: 1, nome: 'Frango Grelhado com Arroz', categoria: 'Pratos principais', precoVenda: 32.90,
    cmv: 9.80, margem: 70.2, status: { label: 'Ótima', cor: 'verde' },
    fichas: [
      { id: 1, quantidade: 0.3, ingrediente: DEMO_INGREDIENTES_REF(1) },
      { id: 2, quantidade: 0.2, ingrediente: DEMO_INGREDIENTES_REF(2) }
    ]
  },
  {
    id: 2, nome: 'Pizza Mussarela', categoria: 'Pizzas', precoVenda: 45.00,
    cmv: 14.50, margem: 67.8, status: { label: 'Ótima', cor: 'verde' },
    fichas: [
      { id: 3, quantidade: 0.25, ingrediente: DEMO_INGREDIENTES_REF(4) },
      { id: 4, quantidade: 0.3, ingrediente: DEMO_INGREDIENTES_REF(5) }
    ]
  },
  {
    id: 3, nome: 'Salada Caprese', categoria: 'Entradas', precoVenda: 18.00,
    cmv: 13.20, margem: 26.7, status: { label: 'Baixa', cor: 'vermelho' },
    fichas: [
      { id: 5, quantidade: 0.4, ingrediente: DEMO_INGREDIENTES_REF(3) },
      { id: 6, quantidade: 0.2, ingrediente: DEMO_INGREDIENTES_REF(4) }
    ]
  }
];

function DEMO_INGREDIENTES_REF(id) {
  return DEMO_INGREDIENTES.find(i => i.id === id);
}

const DEMO_ALERTAS = [
  { id: 1, tipo: 'estoque_baixo', mensagem: 'Tomate está com estoque baixo (3 kg)', lida: false, criadaEm: new Date().toISOString() },
  { id: 2, tipo: 'margem_critica', mensagem: 'Salada Caprese está com margem baixa (26.7%). Preço sugerido: R$ 26,40 para atingir 50% de margem.', lida: false, criadaEm: new Date().toISOString() }
];

window.DEMO = {
  restaurante: DEMO_RESTAURANTE,
  ingredientes: DEMO_INGREDIENTES,
  fornecedores: DEMO_FORNECEDORES,
  pratos: DEMO_PRATOS,
  alertas: DEMO_ALERTAS
};