"""Small, Blender-independent sweep mesh with transported frames and round caps."""
import math


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def mul(a, scale):
    return tuple(x * scale for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def unit(a):
    length = math.sqrt(dot(a, a))
    if length < 1e-10:
        raise ValueError("Degenerate sweep direction")
    return mul(a, 1 / length)


def catmull(points, steps=8):
    result = []
    for i in range(len(points) - 1):
        p0, p1 = points[max(0, i-1)], points[i]
        p2, p3 = points[i+1], points[min(len(points)-1, i+2)]
        for j in range(steps):
            t = j / steps
            result.append(tuple(.5 * (2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t)
                                for a, b, c, d in zip(p0, p1, p2, p3)))
    result.append(tuple(points[-1]))
    return result


def sweep(points, widths, sides=16, steps=8, depth=.72):
    """Return a closed manifold and centerline frames for local belly coloring.

    The initial belly points toward the camera (-Y); subsequent rings transport
    that direction, rather than resetting it against a world axis at each bend.
    """
    centers = catmull(points, steps)
    radii = [p[0] for p in catmull([(r,) for r in widths], steps)]
    tangents = [unit(sub(centers[min(i+1, len(centers)-1)], centers[max(i-1, 0)]))
                for i in range(len(centers))]
    belly = (0., -1., 0.)
    frames = []
    for tangent in tangents:
        projected = sub(belly, mul(tangent, dot(belly, tangent)))
        if dot(projected, projected) < 1e-8:
            projected = cross(tangent, (1., 0., 0.))
        belly = unit(projected)
        side = unit(cross(belly, tangent))
        frames.append((side, belly))

    rings = [(c, r, frame) for c, r, frame in zip(centers, radii, frames)]
    # Four latitude rings plus one pole; no coincident zero-radius vertex ring.
    for q in range(1, 5):
        angle = math.pi * .5 * q / 5
        rings.append((add(centers[-1], mul(tangents[-1], radii[-1]*math.sin(angle))),
                      radii[-1]*math.cos(angle), frames[-1]))
    vertices, faces = [], []
    for center, radius, (side, belly) in rings:
        for j in range(sides):
            a = 2*math.pi*j/sides
            vertices.append(add(center, add(mul(side, radius*math.cos(a)),
                                             mul(belly, radius*depth*math.sin(a)))))
    for i in range(len(rings)-1):
        for j in range(sides):
            nj = (j+1) % sides
            faces.append((i*sides+j, i*sides+nj, (i+1)*sides+nj, (i+1)*sides+j))
    root = len(vertices)
    vertices.append(centers[0])
    tip = len(vertices)
    vertices.append(add(centers[-1], mul(tangents[-1], radii[-1])))
    end = (len(rings)-1)*sides
    for j in range(sides):
        nj = (j+1) % sides
        faces.extend(((root, nj, j), (tip, end+j, end+nj)))
    return vertices, faces, list(zip(centers, radii, frames))
