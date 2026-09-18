import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
getAllCourses,
getCourseById,
createCourse,
updateCourse,
deleteCourse,
} from '../../src/controllers/courses.controller.js';
import { pool } from '../../src/config/db.js';

vi.mock('../../src/config/db.js', () => ({
pool: {
query: vi.fn(),
},
}));

function createMockReq({
params = {},
body = {},
user = {
role: 'admin',
sub: 1,
},
} = {}) {
return {
params,
body,
user,
};
}

function createMockRes() {
return {
status: vi.fn().mockReturnThis(),
json: vi.fn().mockReturnThis(),
};
}

describe('Courses Controller', () => {
beforeEach(() => {
vi.clearAllMocks();
});

// --------------------------------------------------
// GET ALL COURSES
// --------------------------------------------------

describe('getAllCourses', () => {
it('returns all courses for admin/user', async () => {
const courses = [
{
id: 2,
name: 'Course 2',
description: 'Description 2',
},
{
id: 1,
name: 'Course 1',
description: 'Description 1',
},
];

  pool.query.mockResolvedValueOnce([courses]);

  const req = createMockReq({
    user: {
      role: 'admin',
      sub: 1,
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await getAllCourses(req, res, next);

  expect(pool.query).toHaveBeenCalledWith(
    'SELECT * FROM courses ORDER BY id DESC'
  );

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    count: courses.length,
    data: courses,
  });

  expect(next).not.toHaveBeenCalled();
});

it('returns only teacher courses for teacher', async () => {
  const courses = [
    {
      id: 2,
      name: 'Teacher Course',
      description: 'Teacher description',
    },
  ];

  pool.query.mockResolvedValueOnce([courses]);

  const req = createMockReq({
    user: {
      role: 'teacher',
      sub: 5,
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await getAllCourses(req, res, next);

  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining('SELECT DISTINCT c.*'),
    [5]
  );

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    count: courses.length,
    data: courses,
  });

  expect(next).not.toHaveBeenCalled();
});

it('passes database errors to next', async () => {
  const databaseError = new Error('Database error');

  pool.query.mockRejectedValueOnce(databaseError);

  const req = createMockReq({
    user: {
      role: 'admin',
      sub: 1,
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await getAllCourses(req, res, next);

  expect(next).toHaveBeenCalledWith(databaseError);
});
 
});

// --------------------------------------------------
// GET COURSE BY ID
// --------------------------------------------------

describe('getCourseById', () => {
it('returns a course by id', async () => {
const course = {
id: 1,
name: 'Test Course',
description: 'Test description',
};

   pool.query.mockResolvedValueOnce([[course]]);

  const req = createMockReq({
    params: {
      id: '1',
    },
    user: {
      role: 'admin',
      sub: 1,
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await getCourseById(req, res, next);

  expect(pool.query).toHaveBeenCalledWith(
    'SELECT * FROM courses WHERE id = ?',
    ['1']
  );

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    data: course,
  });

  expect(next).not.toHaveBeenCalled();
});

it('throws 404 when course does not exist', async () => {
  pool.query.mockResolvedValueOnce([[]]);

  const req = createMockReq({
    params: {
      id: '999',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await getCourseById(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);

  const error = next.mock.calls[0][0];

  expect(error.statusCode).toBe(404);
  expect(error.message).toBe('Course not found');
});

it('throws 403 when teacher does not own the course', async () => {
  const course = {
    id: 1,
    name: 'Test Course',
    description: 'Test description',
  };

  pool.query
    .mockResolvedValueOnce([[course]])
    .mockResolvedValueOnce([[]]);

  const req = createMockReq({
    params: {
      id: '1',
    },
    user: {
      role: 'teacher',
      sub: 99,
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await getCourseById(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('SELECT 1'),
    ['1', 99]
  );

  expect(next).toHaveBeenCalledTimes(1);

  const error = next.mock.calls[0][0];

  expect(error.statusCode).toBe(403);
  expect(error.message).toBe(
    'You do not have access to this course'
  );
});

it('allows teacher to access a course they own', async () => {
  const course = {
    id: 1,
    name: 'Teacher Course',
    description: 'Description',
  };

  pool.query
    .mockResolvedValueOnce([[course]])
    .mockResolvedValueOnce([[{ 1: 1 }]]);

  const req = createMockReq({
    params: {
      id: '1',
    },
    user: {
      role: 'teacher',
      sub: 5,
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await getCourseById(req, res, next);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    success: true,
    data: course,
  });

  expect(next).not.toHaveBeenCalled();
});
 
});

// --------------------------------------------------
// CREATE COURSE
// --------------------------------------------------

describe('createCourse', () => {
it('creates a course successfully', async () => {
const newCourse = {
id: 10,
name: 'New Course',
description: 'New description',
start_date: '2026-09-01',
end_date: '2026-12-31',
};

   pool.query
    .mockResolvedValueOnce([
      {
        insertId: 10,
      },
    ])
    .mockResolvedValueOnce([[newCourse]]);

  const req = createMockReq({
    body: {
      name: 'New Course',
      description: 'New description',
      start_date: '2026-09-01',
      end_date: '2026-12-31',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await createCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    1,
    'INSERT INTO courses (name, description, start_date, end_date) VALUES (?, ?, ?, ?)',
    [
      'New Course',
      'New description',
      '2026-09-01',
      '2026-12-31',
    ]
  );

  expect(pool.query).toHaveBeenNthCalledWith(
    2,
    'SELECT * FROM courses WHERE id = ?',
    [10]
  );

  expect(res.status).toHaveBeenCalledWith(201);

  expect(res.json).toHaveBeenCalledWith({
    success: true,
    message: 'Course created successfully',
    data: newCourse,
  });

  expect(next).not.toHaveBeenCalled();
});

it('creates a course with null description when description is missing', async () => {
  const newCourse = {
    id: 11,
    name: 'Course Without Description',
    description: null,
  };

  pool.query
    .mockResolvedValueOnce([
      {
        insertId: 11,
      },
    ])
    .mockResolvedValueOnce([[newCourse]]);

  const req = createMockReq({
    body: {
      name: 'Course Without Description',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await createCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    1,
    'INSERT INTO courses (name, description, start_date, end_date) VALUES (?, ?, ?, ?)',
    [
      'Course Without Description',
      null,
      null,
      null,
    ]
  );

  expect(res.status).toHaveBeenCalledWith(201);
  expect(next).not.toHaveBeenCalled();
});

it('normalizes YYYY/MM/DD dates', async () => {
  pool.query
    .mockResolvedValueOnce([
      {
        insertId: 12,
      },
    ])
    .mockResolvedValueOnce([
      [
        {
          id: 12,
          name: 'Date Course',
        },
      ],
    ]);

  const req = createMockReq({
    body: {
      name: 'Date Course',
      start_date: '2026/09/15',
      end_date: '2026/12/31',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await createCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    1,
    'INSERT INTO courses (name, description, start_date, end_date) VALUES (?, ?, ?, ?)',
    [
      'Date Course',
      null,
      '2026-09-15',
      '2026-12-31',
    ]
  );
});

it('normalizes DD/MM/YYYY dates', async () => {
  pool.query
    .mockResolvedValueOnce([
      {
        insertId: 13,
      },
    ])
    .mockResolvedValueOnce([
      [
        {
          id: 13,
          name: 'Date Course',
        },
      ],
    ]);

  const req = createMockReq({
    body: {
      name: 'Date Course',
      start_date: '15/09/2026',
      end_date: '31/12/2026',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await createCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    1,
    'INSERT INTO courses (name, description, start_date, end_date) VALUES (?, ?, ?, ?)',
    [
      'Date Course',
      null,
      '2026-09-15',
      '2026-12-31',
    ]
  );
});

it('returns 400 when course name is missing', async () => {
  const req = createMockReq({
    body: {
      description: 'Description only',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await createCourse(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);

  const error = next.mock.calls[0][0];

  expect(error.statusCode).toBe(400);
  expect(error.message).toBe('Course name is required');

  expect(pool.query).not.toHaveBeenCalled();
});
 
});

// --------------------------------------------------
// UPDATE COURSE
// --------------------------------------------------

describe('updateCourse', () => {
it('updates a course successfully', async () => {
const updatedCourse = {
id: 1,
name: 'Updated Course',
description: 'Updated description',
start_date: '2026-09-01',
end_date: '2026-12-31',
};

   pool.query
    .mockResolvedValueOnce([
      [
        {
          id: 1,
        },
      ],
    ])
    .mockResolvedValueOnce([{}])
    .mockResolvedValueOnce([[updatedCourse]]);

  const req = createMockReq({
    params: {
      id: '1',
    },
    body: {
      name: 'Updated Course',
      description: 'Updated description',
      start_date: '2026-09-01',
      end_date: '2026-12-31',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await updateCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    1,
    'SELECT id FROM courses WHERE id = ?',
    ['1']
  );

  expect(pool.query).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('UPDATE courses SET'),
    [
      'Updated Course',
      'Updated description',
      '2026-09-01',
      '2026-12-31',
      '1',
    ]
  );

  expect(pool.query).toHaveBeenNthCalledWith(
    3,
    'SELECT * FROM courses WHERE id = ?',
    ['1']
  );

  expect(res.status).toHaveBeenCalledWith(200);

  expect(res.json).toHaveBeenCalledWith({
    success: true,
    message: 'Course updated successfully',
    data: updatedCourse,
  });

  expect(next).not.toHaveBeenCalled();
});

it('updates only the provided fields', async () => {
  const updatedCourse = {
    id: 1,
    name: 'Updated Name',
    description: 'Old description',
  };

  pool.query
    .mockResolvedValueOnce([
      [
        {
          id: 1,
        },
      ],
    ])
    .mockResolvedValueOnce([{}])
    .mockResolvedValueOnce([[updatedCourse]]);

  const req = createMockReq({
    params: {
      id: '1',
    },
    body: {
      name: 'Updated Name',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await updateCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('UPDATE courses SET'),
    [
      'Updated Name',
      undefined,
      null,
      null,
      '1',
    ]
  );

  expect(res.status).toHaveBeenCalledWith(200);
  expect(next).not.toHaveBeenCalled();
});

it('normalizes dates when updating a course', async () => {
  const updatedCourse = {
    id: 1,
    name: 'Course',
    start_date: '2026-09-15',
    end_date: '2026-12-31',
  };

  pool.query
    .mockResolvedValueOnce([
      [
        {
          id: 1,
        },
      ],
    ])
    .mockResolvedValueOnce([{}])
    .mockResolvedValueOnce([[updatedCourse]]);

  const req = createMockReq({
    params: {
      id: '1',
    },
    body: {
      start_date: '15/09/2026',
      end_date: '31/12/2026',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await updateCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('UPDATE courses SET'),
    [
      undefined,
      undefined,
      '2026-09-15',
      '2026-12-31',
      '1',
    ]
  );
});

it('throws 404 when updating a non-existing course', async () => {
  pool.query.mockResolvedValueOnce([[]]);

  const req = createMockReq({
    params: {
      id: '999',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await updateCourse(req, res, next);

  expect(pool.query).toHaveBeenCalledWith(
    'SELECT id FROM courses WHERE id = ?',
    ['999']
  );

  expect(next).toHaveBeenCalledTimes(1);

  const error = next.mock.calls[0][0];

  expect(error.statusCode).toBe(404);
  expect(error.message).toBe('Course not found');
});

it('passes database errors to next', async () => {
  const databaseError = new Error('Database error');

  pool.query.mockRejectedValueOnce(databaseError);

  const req = createMockReq({
    params: {
      id: '1',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await updateCourse(req, res, next);

  expect(next).toHaveBeenCalledWith(databaseError);
});
 
});

// --------------------------------------------------
// DELETE COURSE
// --------------------------------------------------

describe('deleteCourse', () => {
it('deletes a course successfully', async () => {
pool.query
.mockResolvedValueOnce([
[
{
id: 1,
},
],
])
.mockResolvedValueOnce([{}]);

   const req = createMockReq({
    params: {
      id: '1',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await deleteCourse(req, res, next);

  expect(pool.query).toHaveBeenNthCalledWith(
    1,
    'SELECT id FROM courses WHERE id = ?',
    ['1']
  );

  expect(pool.query).toHaveBeenNthCalledWith(
    2,
    'DELETE FROM courses WHERE id = ?',
    ['1']
  );

  expect(res.status).toHaveBeenCalledWith(200);

  expect(res.json).toHaveBeenCalledWith({
    success: true,
    message: 'Course deleted successfully',
  });

  expect(next).not.toHaveBeenCalled();
});

it('throws 404 when deleting a non-existing course', async () => {
  pool.query.mockResolvedValueOnce([[]]);

  const req = createMockReq({
    params: {
      id: '999',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await deleteCourse(req, res, next);

  expect(pool.query).toHaveBeenCalledWith(
    'SELECT id FROM courses WHERE id = ?',
    ['999']
  );

  expect(next).toHaveBeenCalledTimes(1);

  const error = next.mock.calls[0][0];

  expect(error.statusCode).toBe(404);
  expect(error.message).toBe('Course not found');
});

it('passes database errors to next', async () => {
  const databaseError = new Error('Database error');

  pool.query.mockRejectedValueOnce(databaseError);

  const req = createMockReq({
    params: {
      id: '1',
    },
  });

  const res = createMockRes();
  const next = vi.fn();

  await deleteCourse(req, res, next);

  expect(next).toHaveBeenCalledWith(databaseError);
});

});
});
