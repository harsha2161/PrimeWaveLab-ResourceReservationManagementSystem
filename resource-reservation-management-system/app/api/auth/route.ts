import prisma from "@/lib/prisma";
import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";


export async function POST(request : NextRequest){
    const body = await request.json();
   
    if(body.email == null){
        return NextResponse.json({
            message : "email is required"
        })
    }
    const user = await prisma.users.findFirst({
        where : {
            email : body.email
        }
    })

    if(user == null){
        return NextResponse.json({
            message : "user not found"
        })
    }
    
    const isPasswordValid = await compare(body.password,user.password)
    if(isPasswordValid){
        return NextResponse.json({
            message : "login succesfully"
            
        })
    }

    
}