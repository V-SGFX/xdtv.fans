#!/usr/bin/env node

/**
 * Reset Admin Password Script
 * Resetuje hasło użytkownika admin w xdtv backend
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetAdminPassword() {
  console.log('\n🔐 Reset Hasła Administratora XDTV\n');

  try {
    // Sprawdź czy istnieje admin
    const admin = await prisma.user.findFirst({
      where: { email: 'admin@xdtv.fans', role: 'ADMIN' }
    });

    if (!admin) {
      console.log('❌ Nie znaleziono użytkownika admin@xdtv.fans');
      console.log('   Tworzę nowego admina...\n');
      
      const password = await question('Podaj hasło dla nowego admina: ');
      
      if (!password || password.length < 6) {
        console.log('❌ Hasło musi mieć co najmniej 6 znaków!');
        process.exit(1);
      }

      const hash = await bcrypt.hash(password, 10);
      
      const newAdmin = await prisma.user.create({
        data: {
          email: 'admin@xdtv.fans',
          username: 'admin',
          passwordHash: hash,
          displayName: 'Administrator',
          role: 'ADMIN',
          isActive: true,
          isEmailVerified: true,
        },
      });

      console.log('\n✅ Utworzono nowego admina!');
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Hasło: ${password}`);
      console.log('\n📝 ZAPISZ TO HASŁO W BEZPIECZNYM MIEJSCU!\n');
      
    } else {
      console.log(`✓ Znaleziono admina: ${admin.email}\n`);
      
      const password = await question('Podaj nowe hasło: ');
      
      if (!password || password.length < 6) {
        console.log('❌ Hasło musi mieć co najmniej 6 znaków!');
        process.exit(1);
      }

      const hash = await bcrypt.hash(password, 10);
      
      await prisma.user.update({
        where: { id: admin.id },
        data: { 
          passwordHash: hash,
          isActive: true,
          isEmailVerified: true,
        },
      });

      console.log('\n✅ Hasło zostało zresetowane!');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Nowe hasło: ${password}`);
      console.log('\n📝 ZAPISZ TO HASŁO W BEZPIECZNYM MIEJSCU!\n');
    }

    console.log('🌐 Możesz się teraz zalogować:');
    console.log('   URL: http://localhost:4000/admin');
    console.log(`   Email: admin@xdtv.fans`);
    console.log(`   Password: ${password || '(wpisane powyżej)'}\n`);

  } catch (error) {
    console.error('\n❌ Błąd:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

resetAdminPassword();
