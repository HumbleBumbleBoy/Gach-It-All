import { prisma } from "./lib/prisma";

async function main() {
  console.log("Testing database connection...");
  
  const userCount = await prisma.user.count();
  console.log(`Users in database: ${userCount}`);
  
  const cardCount = await prisma.cardTemplates.count();
  console.log(`Card templates in database: ${cardCount}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });