
import { openai } from "@/lib/openai";
import { getPineconeClient } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/validators/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "@langchain/pinecone";
import { NextRequest } from "next/server";
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { db } from "@/db";

export const POST=async(req:NextRequest)=>{
   try {
    const reqBody=await req.json()
    const {getUser}=getKindeServerSession()
    const user=await getUser()

    if(!user?.id)return new Response("Unauthorized",{status: 401})
    const {fileId,message}=SendMessageValidator.parse(reqBody)

    const file=await db.file.findFirst({
        where:{
            id:fileId,
            userId:user.id
        }
    })

    if(!file)return new Response("Not found",{status: 404})

    await db.message.create({
        data:{
            text:message,
            isUserMessage:true,
            userId:user.id,
            fileId
            
        }
    })
    const pinecone = await getPineconeClient()

    const pineconeIndex = pinecone.Index('chat-pdf')

    
    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      })


    const vectorStore=await PineconeStore.fromExistingIndex(embeddings,{
      //@ts-ignore
        pineconeIndex,
        namespace:fileId
    })  

    const results=await vectorStore.similaritySearch(message,4)
    const prevMessages=await db.message.findMany({
        where:{
            fileId
        },
        orderBy:{
            createdAt:"asc"
        },take:7
    })

    const formattedPrevMessages = prevMessages.map((msg: { isUserMessage: any; text: any; }) => ({
        role: msg.isUserMessage
          ? ('user' as const)
          : ('assistant' as const),
        content: msg.text,
      }))
    
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        stream: true,
        messages: [
          {
            role: 'system',
            content:
              'Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.',
          },
          {
            role: 'user',
            content: `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.
            
      \n----------------\n
      
      PREVIOUS CONVERSATION:
      ${formattedPrevMessages.map((message: { role: string; content: any; }) => {
        if (message.role === 'user')
          return `User: ${message.content}\n`
        return `Assistant: ${message.content}\n`
      })}
      
      \n----------------\n
      
      CONTEXT:
      ${results.map((r) => r.pageContent).join('\n\n')}
      
      USER INPUT: ${message}`,
          },
        ],
      })
      const stream = OpenAIStream(response, {
        async onCompletion(completion) {
          await db.message.create({
            data: {
              text: completion,
              isUserMessage: false,
              fileId,
              userId:user.id,
            },
          })
        },
      })
      return new StreamingTextResponse(stream)
    
   } catch (error:any) {
    
    console.log(error.message)
   }


}