import { deleteItem, isPluggyConfigured } from "./client";

/**
 * Revoga na Pluggy os bancos conectados (Open Finance) que o app está largando: sem isso a Pluggy
 * continua com acesso ao extrato dela (e cobrando o item), mesmo depois de a conexão sumir do app.
 * Usado ao apagar a conta e ao limpar os lançamentos.
 *
 * Melhor esforço e com teto por item: a Pluggy fora do ar não pode impedir ninguém de apagar a
 * conta nem de limpar os dados.
 */
export async function revogarNaPluggy(itemIds: readonly string[], tetoMs = 8000): Promise<void> {
  if (itemIds.length === 0 || !isPluggyConfigured()) return;
  await Promise.allSettled(
    itemIds.map((itemId) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const teto = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, tetoMs);
      });
      return Promise.race([deleteItem(itemId), teto]).finally(() => clearTimeout(timer));
    }),
  );
}
