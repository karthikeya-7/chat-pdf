import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { UTApi } from "uploadthing/server";
import {PDFLoader} from "langchain/document_loaders/fs/pdf"
import {OpenAIEmbeddings} from  'langchain/embeddings/openai'
import {getPineconeClient} from "@/lib/pinecone"
import {PineconeStore} from "@langchain/pinecone"
export const utapi = new UTApi();
 
 
const f = createUploadthing();
 
const auth = (req: Request) => ({ id: "fakeId" });
 
export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
    const { getUser } = getKindeServerSession()
      const user = await getUser();
 
      if (!user || !user.id ) throw new UploadThingError("Unauthorized");
 
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
  
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name:file.name,
          userId: metadata.userId,
          url: file.url,
          uploadStatus: "PROCESSING",

        },
      })

      try {
        const response = await fetch (file.url)
        const blob = await response.blob()

        const loader = new PDFLoader(blob)

        const pageLevelDocs = await loader.load()

        const pagesAmt = pageLevelDocs.length



        //vectorize and index the entire document
        const pinecone = await getPineconeClient()
        const pineconeIndex = pinecone.Index("chat-pdf")

        const embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY
        })


        await PineconeStore.fromDocuments(
          pageLevelDocs,
          embeddings,
          {
            //@ts-ignore
            pineconeIndex,
            namespace: createdFile.id,
          }
        )
        
        await db.file.update({
          data: {
            uploadStatus: 'SUCCESS',
          },
          where: {
            id: createdFile.id,
          },
        })

      } catch (err:any) {
        console.log(err.message)
        await db.file.update({
          data: {
            uploadStatus: 'FAILED',
          },
          where: {
            id: createdFile.id,
          },
        })
      }
    }

    )
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;