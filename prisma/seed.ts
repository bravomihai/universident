import "dotenv/config";

import { prisma } from "../src/lib/prisma";

const treatments = [
    {
        name: "Consultație",
        slug: "consultatie",
        description:
            "Evaluarea generală a sănătății orale și stabilirea pașilor următori de tratament.",
    },
    {
        name: "Igienizare",
        slug: "igienizare",
        description:
            "Detartraj, periaj profesional și alte proceduri pentru îndepărtarea plăcii și tartrului.",
    },
    {
        name: "Carii și obturații",
        slug: "carii-si-obturatii",
        description:
            "Evaluarea și tratarea cariilor dentare prin restaurări și obturații.",
    },
    {
        name: "Tratament de canal",
        slug: "tratament-de-canal",
        description:
            "Proceduri endodontice pentru tratarea infecțiilor sau inflamațiilor din interiorul dintelui.",
    },
    {
        name: "Afecțiuni gingivale",
        slug: "afectiuni-gingivale",
        description:
            "Evaluarea și tratamentul problemelor gingivale și parodontale.",
    },
    {
        name: "Protetică dentară",
        slug: "protetica-dentara",
        description:
            "Consultații și tratamente pentru coroane, punți, proteze și alte restaurări protetice.",
    },
    {
        name: "Stomatologie pediatrică",
        slug: "stomatologie-pediatrica",
        description:
            "Consultații și tratamente stomatologice adaptate copiilor și adolescenților.",
    },
    {
        name: "Chirurgie dento-alveolară",
        slug: "chirurgie-dento-alveolara",
        description:
            "Evaluarea și realizarea procedurilor chirurgicale dentare, inclusiv extracții.",
    },
    {
        name: "Ortodonție",
        slug: "ortodontie",
        description:
            "Evaluarea alinierii dinților și a mușcăturii, precum și monitorizarea tratamentelor ortodontice.",
    },
] as const;

const cities = [
  {
    name: "Arad",
    slug: "arad",
  },
  {
    name: "București",
    slug: "bucuresti",
  },
  {
    name: "Cluj-Napoca",
    slug: "cluj-napoca",
  },
  {
    name: "Constanța",
    slug: "constanta",
  },
  {
    name: "Craiova",
    slug: "craiova",
  },
  {
    name: "Galați",
    slug: "galati",
  },
  {
    name: "Iași",
    slug: "iasi",
  },
  {
    name: "Oradea",
    slug: "oradea",
  },
  {
    name: "Sibiu",
    slug: "sibiu",
  },
  {
    name: "Târgu Mureș",
    slug: "targu-mures",
  },
  {
    name: "Timișoara",
    slug: "timisoara",
  },
] as const;

async function main() {
    for (const treatment of treatments) {
        await prisma.treatment.upsert({
            where: {
                slug: treatment.slug,
            },
            update: {
                name: treatment.name,
                description: treatment.description,
                isActive: true,
            },
            create: {
                name: treatment.name,
                slug: treatment.slug,
                description: treatment.description,
                isActive: true,
            },
        });
    }

    for (const city of cities) {
        await prisma.city.upsert({
            where: {
                slug: city.slug,
            },
            update: {
                name: city.name,
                isActive: true,
            },
            create: {
                name: city.name,
                slug: city.slug,
                isActive: true,
            },
        });
    }

    console.log(
        `Au fost configurate ${treatments.length} tratamente și ${cities.length} orașe.`,
    );
}

main()
    .catch((error: unknown) => {
        console.error("Seed-ul a eșuat:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });