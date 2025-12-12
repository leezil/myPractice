using System;
namespace ex251027
{
    class Point : Object, ICloneable
    {
        private int x;
        public int X { get { return x; } set { x = value; } }
        private int y;
        public int Y { get { return y; } set { y = value; } }

        public Point(int x, int y)
        {
            this.x = x;
            this.y = y;
        }

        public override string ToString()
        {
            return $"({X},{Y})";
        }

        public object Clone()
        {
            return MemberwiseClone(); //Shallow copy
        }
    }
    class Program
    {
        private static void Main(string[] args)
        {
            Point pt1 = Point(2, 3);
            Console.WriteLine(pt1);

            Point pt2 = pt1.Clone() as Point;
            Console.WriteLine(pt2?.ToString());
        }
    }
}