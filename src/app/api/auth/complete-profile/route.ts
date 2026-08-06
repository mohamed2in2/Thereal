import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStudentSessionWithRetry } from '@/lib/auth'
import { normalizeEgyptPhone } from '@/lib/phone'

export async function POST(request: NextRequest) {
  try {
    // 2 retries × 100ms — enough for the post-signup JWT cookie to propagate,
    // without the 1.5s penalty of the default 5-retry config.
    const session = await getStudentSessionWithRetry(2, 100)

    if (!session) {
      console.error('Complete profile: No session found after retries')
      return NextResponse.json(
        { error: 'غير مصرح: لم يتم العثور على الجلسة. حاول مرة أخرى بعد لحظات.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone, parentPhone, age, educationalStage } = body

    if (!name?.trim() || !phone?.trim() || !parentPhone?.trim() || !age || !educationalStage?.trim()) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizeEgyptPhone(String(phone).trim())
    const normalizedParentPhone = normalizeEgyptPhone(String(parentPhone).trim())

    if (normalizedPhone === normalizedParentPhone) {
      return NextResponse.json(
        { error: 'رقم المتعلم لا يمكن أن يكون نفس رقم الوالد/الوالدة' },
        { status: 400 }
      )
    }

    let user = await prisma.user.findUnique({
      where: { id: session.id },
    })

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: session.email } })
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: session.email,
          name: session.name,
          role: 'student',
          profileCompleted: false,
        },
      })
    }

    // Update user profile with trimmed values
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        parentPhone: normalizedParentPhone,
        age: age ? parseInt(String(age)) : undefined,
        educationalStage: educationalStage.trim(),
        profileCompleted: true,
      },
    })

    return NextResponse.json(
      { user },
      { status: 200 }
    )
  } catch (error) {
    console.error('Complete profile error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    )
  }
}
