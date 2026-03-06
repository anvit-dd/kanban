"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import { isBoardState, type BoardState } from "@/lib/board";
import { createSessionToken, getCurrentUser, sessionCookieName, sessionCookieOptions } from "@/lib/auth";
import {
  createProjectForUser,
  createUser,
  deleteProjectForUser,
  getBoardForProject,
  getProjectForUser,
  getUserByEmail,
  listProjectsForUser,
  replaceBoardForProject,
} from "@/lib/store";

export type AuthState = {
  error?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function createSession(userId: number, email: string) {
  const token = await createSessionToken({ userId, email });
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, token, sessionCookieOptions);
}

export async function signUpAction(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (password.length < 6) {
    return { error: "Password should be at least 6 characters." };
  }

  if (getUserByEmail(email)) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser(email, passwordHash);
  createProjectForUser(user.id, "General");
  await createSession(user.id, user.email);
  revalidatePath("/");
  redirect("/");
}

export async function signInAction(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = getUserByEmail(email);

  if (!user) {
    return { error: "Invalid email or password." };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id, user.email);
  revalidatePath("/");
  redirect("/");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  revalidatePath("/");
  redirect("/");
}

export async function createProjectAction(name: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Project name is required.");
  }

  const project = createProjectForUser(user.id, normalizedName, false);
  const projects = listProjectsForUser(user.id);

  revalidatePath("/");
  return {
    activeProjectId: project.id,
    board: getBoardForProject(user.id, project.id),
    projects: projects.map((item) => ({ id: item.id, name: item.name })),
  };
}

export async function deleteProjectAction(projectId: number) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  deleteProjectForUser(user.id, projectId);

  const projects = listProjectsForUser(user.id);
  const nextProject = projects[0];

  if (!nextProject) {
    throw new Error("No projects available.");
  }

  revalidatePath("/");
  return {
    activeProjectId: nextProject.id,
    board: getBoardForProject(user.id, nextProject.id),
    projects: projects.map((item) => ({ id: item.id, name: item.name })),
  };
}

export async function saveBoardAction(projectId: number, board: BoardState) {
  if (!isBoardState(board)) {
    throw new Error("Invalid board payload.");
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const project = getProjectForUser(user.id, projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  replaceBoardForProject(user.id, projectId, board);
  return getBoardForProject(user.id, projectId);
}

export async function getProjectsAction() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  return listProjectsForUser(user.id).map((project) => ({ id: project.id, name: project.name }));
}

export async function getProjectDataAction(projectId: number) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized.");
  }

  const project = getProjectForUser(user.id, projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  return {
    activeProjectId: project.id,
    board: getBoardForProject(user.id, project.id),
  };
}
