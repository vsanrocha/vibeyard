import { execFile } from 'child_process';

export interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  conflicted: number;
}

const NOT_A_REPO: GitStatus = {
  isGitRepo: false,
  branch: null,
  ahead: 0,
  behind: 0,
  staged: 0,
  modified: 0,
  untracked: 0,
  conflicted: 0,
};

export function getGitStatus(cwd: string): Promise<GitStatus> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['status', '--porcelain=v2', '--branch'],
      { cwd, timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve(NOT_A_REPO);
          return;
        }

        let branch: string | null = null;
        let ahead = 0;
        let behind = 0;
        let staged = 0;
        let modified = 0;
        let untracked = 0;
        let conflicted = 0;

        for (const line of stdout.split('\n')) {
          if (line.startsWith('# branch.head ')) {
            branch = line.slice('# branch.head '.length);
          } else if (line.startsWith('# branch.ab ')) {
            const match = line.match(/\+(\d+) -(\d+)/);
            if (match) {
              ahead = parseInt(match[1], 10);
              behind = parseInt(match[2], 10);
            }
          } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
            // Ordinary/rename entries: XY field is at index 2 (after the type char and space)
            const xy = line.split(' ')[1];
            if (xy && xy.length >= 2) {
              const x = xy[0]; // staged
              const y = xy[1]; // working tree
              if (x !== '.') staged++;
              if (y !== '.') modified++;
            }
          } else if (line.startsWith('u ')) {
            conflicted++;
          } else if (line.startsWith('? ')) {
            untracked++;
          }
        }

        resolve({
          isGitRepo: true,
          branch,
          ahead,
          behind,
          staged,
          modified,
          untracked,
          conflicted,
        });
      }
    );
  });
}
