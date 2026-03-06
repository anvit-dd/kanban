import { redirect } from "next/navigation";

import { BoardClient } from "@/components/board-client";
import { getCurrentUser } from "@/lib/auth";
import { createProjectForUser, getBoardForProject, listProjectsForUser } from "@/lib/store";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  let projects = listProjectsForUser(user.id);

  if (projects.length === 0) {
    createProjectForUser(user.id, "General");
    projects = listProjectsForUser(user.id);
  }

  const activeProject = projects[0];
  const board = getBoardForProject(user.id, activeProject.id);

  return (
    <BoardClient
      initialBoard={board}
      initialProjectId={activeProject.id}
      initialProjects={projects}
      userEmail={user.email}
    />
  );
}
