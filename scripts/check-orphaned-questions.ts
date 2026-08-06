import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Checking for orphaned video questions...");
  try {
    const questions = await prisma.videoQuestion.findMany({
      include: {
        video: {
          select: {
            title: true,
            videoProvider: true,
          },
        },
      },
    });

    const nonYoutube = questions.filter(
      (q) => q.video.videoProvider !== "youtube"
    );

    console.log(`Total video questions found: ${questions.length}`);
    console.log(`Non-YouTube video questions found: ${nonYoutube.length}`);

    if (nonYoutube.length > 0) {
      console.log("\nDetails of Non-YouTube video questions:");
      nonYoutube.forEach((q) => {
        console.log(`- Question ID: ${q.id}`);
        console.log(`  Question: ${q.questionText}`);
        console.log(`  Video ID: ${q.videoId}`);
        console.log(`  Video Title: ${q.video.title}`);
        console.log(`  Provider: ${q.video.videoProvider}`);
      });
    }
  } catch (error) {
    console.error("Check failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
